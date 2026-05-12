import { db } from "@/db";
import {
  bookings,
  paymentEvents,
  properties,
  ratePlans,
  roomTypes,
} from "@/db/schema";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { postPayment, postReservation } from "./reservations";
import { getStripe, publicOrigin } from "@/lib/stripe/client";
import { detachPaymentMethod } from "@/lib/stripe/detach";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { signCancelToken } from "@/lib/crypto";

// Recovery path for bookings where Stripe charged (NR) or saved a card (Flex)
// but Cloudbeds postReservation failed inline. The /api/bookings handler
// returns 502 and leaves a stuck row with status in ('paid','payment_authorized')
// and cloudbedsReservationId NULL. This cron picks them up, retries the CB
// write, and gives up after MAX_ATTEMPTS by unwinding the payment side.
//
// Extras attached at checkout aren't retried — bookingExtras rows are only
// inserted after postCustomItem succeeds, so the original list is lost when
// postReservation fails. Hotel adds them manually if needed.

const MAX_ATTEMPTS = 12; // 12 × 5min cadence = ~1h grace
const MIN_BOOKING_AGE_SECONDS = 60; // skip rows that may still be mid-flight

type Booking = typeof bookings.$inferSelect;

export interface PmsRetryResult {
  bookingId: string;
  outcome: "synced" | "retry_failed" | "gave_up";
  reason?: string;
  cloudbedsReservationId?: string;
}

export async function findEligibleBookings(): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["paid", "payment_authorized"]),
        isNull(bookings.cloudbedsReservationId),
        lt(
          bookings.createdAt,
          sql`NOW() - (${MIN_BOOKING_AGE_SECONDS} * INTERVAL '1 second')`
        )
      )
    )
    .limit(50);
}

export async function retryPmsForBooking(
  booking: Booking
): Promise<PmsRetryResult> {
  if (!booking.propertyId || !booking.roomTypeId || !booking.ratePlanId) {
    return {
      bookingId: booking.id,
      outcome: "retry_failed",
      reason: "missing_fk",
    };
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId))
    .limit(1);
  if (!property?.cloudbedsPropertyId) {
    return {
      bookingId: booking.id,
      outcome: "retry_failed",
      reason: "property_not_cb_connected",
    };
  }

  const [room] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.id, booking.roomTypeId))
    .limit(1);
  const [rate] = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.id, booking.ratePlanId))
    .limit(1);
  if (!room || !rate) {
    return {
      bookingId: booking.id,
      outcome: "retry_failed",
      reason: "missing_room_or_rate",
    };
  }

  // Bump attempt counter + anchor failure window BEFORE the call so a hang
  // can't reset the count. firstPmsFailureAt is sticky on first failure.
  const nextAttempt = (booking.pmsRetryAttempts ?? 0) + 1;
  await db
    .update(bookings)
    .set({
      pmsRetryAttempts: nextAttempt,
      firstPmsFailureAt: booking.firstPmsFailureAt ?? new Date(),
    })
    .where(eq(bookings.id, booking.id));

  if (nextAttempt > MAX_ATTEMPTS) {
    return giveUpAndUnwind(booking);
  }

  try {
    const result = await postReservation(booking.propertyId, {
      cloudbedsPropertyId: property.cloudbedsPropertyId,
      startDate: booking.checkIn,
      endDate: booking.checkOut,
      guestFirstName: booking.guestFirst,
      guestLastName: booking.guestLast,
      guestEmail: booking.guestEmail,
      guestCountry: booking.guestCountry ?? undefined,
      guestPhone: booking.guestPhone ?? undefined,
      roomTypeID: room.otaRoomId,
      ratesID: rate.otaRateId,
      adults: booking.adults ?? 1,
      children: booking.children ?? 0,
      subtotal: Number(booking.grandTotal),
      thirdPartyIdentifier: booking.orderId,
    });
    const cloudbedsReservationId = result.reservationID;

    // For NR rates record the Stripe charge in the CB folio so the hotel's
    // accounting reflects what the guest paid. Best-effort; missing folio
    // line is a reconciliation problem the hotel can fix manually.
    if (booking.rateType === "nr" && booking.stripePaymentIntentId) {
      try {
        await postPayment(booking.propertyId, {
          cloudbedsPropertyId: property.cloudbedsPropertyId,
          reservationID: cloudbedsReservationId,
          amount: Number(booking.grandTotal),
          type: "credit",
          description: `Stripe ${booking.stripePaymentIntentId}`,
        });
      } catch (payErr) {
        console.error(
          `PMS-retry postPayment failed for ${cloudbedsReservationId}:`,
          payErr
        );
      }
    }

    await db
      .update(bookings)
      .set({ cloudbedsReservationId, status: "pms_synced" })
      .where(eq(bookings.id, booking.id));

    // Now that the booking actually exists in CB, send the confirmation that
    // the inline path never got to send.
    const nights = Math.round(
      (new Date(booking.checkOut).getTime() -
        new Date(booking.checkIn).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const cancelUrl =
      booking.rateType === "flex"
        ? `${publicOrigin()}/cancel/${signCancelToken(booking.id)}`
        : undefined;
    void (async () => {
      try {
        // Empty nightlyRates/extras: PMS failed before bookingExtras rows
        // were inserted, so we have no record of what to render. The cron
        // recovers the reservation, not the line-item detail — hotel can
        // fix the folio if extras were lost.
        await sendBookingConfirmationEmail({
          to: booking.guestEmail,
          guestFirstName: booking.guestFirst,
          guestLastName: booking.guestLast,
          hotelName: property.name,
          cloudbedsReservationId,
          orderId: booking.orderId,
          rateType: (booking.rateType as "flex" | "nr") ?? "flex",
          roomName: room.name,
          rateName: rate.name,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          nights,
          adults: booking.adults ?? 1,
          currency: booking.currency,
          roomTotal: Number(booking.roomTotal),
          extrasTotal: Number(booking.extrasTotal),
          grandTotal: Number(booking.grandTotal),
          nightlyRates: [],
          extras: [],
          cancelUrl,
        });
      } catch (e) {
        console.error(
          `PMS-retry confirmation email failed for booking ${booking.id}:`,
          e
        );
      }
    })();

    return {
      bookingId: booking.id,
      outcome: "synced",
      cloudbedsReservationId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `PMS-retry attempt ${nextAttempt}/${MAX_ATTEMPTS} failed for booking ${booking.id}: ${message}`
    );
    return {
      bookingId: booking.id,
      outcome: "retry_failed",
      reason: message,
    };
  }
}

async function giveUpAndUnwind(booking: Booking): Promise<PmsRetryResult> {
  const stripe = getStripe();

  if (booking.rateType === "nr" && booking.stripePaymentIntentId) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        reason: "requested_by_customer",
        refund_application_fee: true,
        reverse_transfer: true,
        metadata: {
          bookingId: booking.id,
          orderId: booking.orderId,
          reason: "pms_giveup",
        },
      });
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "refund",
        stripeId: refund.id,
        amount: (refund.amount / 100).toFixed(2),
        currency: refund.currency.toUpperCase(),
        status: refund.status ?? "pending",
        payload: refund as unknown as Record<string, unknown>,
      });
    } catch (refundErr) {
      console.error(
        `PMS-giveup refund failed for booking ${booking.id}:`,
        refundErr
      );
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "auto_charge_failed",
        status: "refund_failed_at_pms_giveup",
        errorMessage:
          refundErr instanceof Error ? refundErr.message : "Unknown",
      });
    }
  } else if (booking.stripePaymentMethodId) {
    const result = await detachPaymentMethod(
      booking.stripePaymentMethodId
    ).catch((e) => {
      console.error(`PMS-giveup detach failed for booking ${booking.id}:`, e);
      return null;
    });
    if (result) {
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "payment_method_detached",
        stripeId: booking.stripePaymentMethodId,
        status: result.alreadyDetached
          ? "already_detached_at_pms_giveup"
          : "detached_at_pms_giveup",
      });
    }
  }

  await db
    .update(bookings)
    .set({ status: "failed" })
    .where(eq(bookings.id, booking.id));

  return {
    bookingId: booking.id,
    outcome: "gave_up",
    reason: "max_attempts",
  };
}
