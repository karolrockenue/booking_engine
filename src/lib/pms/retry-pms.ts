import { db } from "@/db";
import {
  bookings,
  bookingDayRates,
  paymentEvents,
  properties,
  ratePlans,
  roomTypes,
} from "@/db/schema";
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getPmsAdapter } from "@/lib/pms";
import { getStripe, publicOrigin } from "@/lib/stripe/client";
import { detachPaymentMethod } from "@/lib/stripe/detach";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { signCancelToken } from "@/lib/crypto";

// PMS-agnostic recovery path for bookings where Stripe charged (NR) or saved a
// card (Flex) but the inline PMS createReservation failed. The /api/bookings
// handler returns 502 and leaves a stuck row with status in
// ('paid','payment_authorized') and cloudbedsReservationId (our neutral PMS
// reservation column) NULL. This cron retries the PMS write through the
// adapter, and gives up after MAX_ATTEMPTS by unwinding the payment side.
//
// Anti-double-book: Mews has no idempotency key, so before creating we ask the
// adapter whether a matching reservation already exists (a prior attempt may
// have succeeded in the PMS but we never stored the id). If so we adopt it
// instead of booking the room twice. We also persist the reservation id the
// instant we have it (before recording payment) to shrink the orphan window.
//
// Extras attached at checkout aren't retried — bookingExtras rows are only
// inserted after the extra posts, so the original list is lost when
// createReservation fails. Hotel adds them manually if needed.

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
  // PMS-agnostic connection gate: Cloudbeds needs a resolved property id; Mews
  // acts via its stored credentials (no cloudbedsPropertyId).
  if (
    !property ||
    (property.pmsType !== "mews" && !property.cloudbedsPropertyId)
  ) {
    return {
      bookingId: booking.id,
      outcome: "retry_failed",
      reason: "property_not_connected",
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

  const pms = getPmsAdapter(property);
  const grandTotalNum = Number(booking.grandTotal);

  try {
    // 1. Adopt-or-create. Ask the adapter whether this booking already has a
    //    reservation in the PMS (a prior attempt that succeeded but we never
    //    recorded). Adopting avoids a duplicate; Mews can't dedupe any other
    //    way (no idempotency key).
    let pmsReservationId: string;
    const existing = await pms.findExistingReservation({
      orderId: booking.orderId,
      startDate: booking.checkIn,
      endDate: booking.checkOut,
      roomTypeId: room.otaRoomId,
      guestEmail: booking.guestEmail,
    });

    if (existing) {
      pmsReservationId = existing.pmsReservationId;
      console.log(
        `PMS-retry adopted existing reservation ${pmsReservationId} for booking ${booking.id} (no re-create)`
      );
    } else {
      // Per-night room prices — Mews requires them (TimeUnitPrices); Cloudbeds
      // ignores them. Persisted at booking time in booking_day_rates.
      const dayRates = await db
        .select()
        .from(bookingDayRates)
        .where(eq(bookingDayRates.bookingId, booking.id))
        .orderBy(asc(bookingDayRates.date));
      const nightlyRates = dayRates.map((d) => ({
        date: d.date,
        rate: Number(d.rate),
      }));

      const created = await pms.createReservation({
        startDate: booking.checkIn,
        endDate: booking.checkOut,
        guestFirstName: booking.guestFirst,
        guestLastName: booking.guestLast,
        guestEmail: booking.guestEmail,
        guestCountry: booking.guestCountry ?? undefined,
        guestPhone: booking.guestPhone ?? undefined,
        roomTypeId: room.otaRoomId,
        rateId: rate.otaRateId,
        adults: booking.adults ?? 1,
        children: booking.children ?? 0,
        roomSubtotal: Number(booking.roomTotal),
        orderId: booking.orderId,
        nightlyRates: nightlyRates.length > 0 ? nightlyRates : undefined,
      });
      pmsReservationId = created.pmsReservationId;
    }

    // 2. Persist-first. Store the reservation id (+ advance status) immediately,
    //    so a crash after this point can never trigger a duplicate create.
    await db
      .update(bookings)
      .set({ cloudbedsReservationId: pmsReservationId, status: "pms_synced" })
      .where(eq(bookings.id, booking.id));

    // 3. For NR rates record the Stripe charge in the PMS folio (external
    //    payment for Mews). Best-effort; missing folio line is a reconciliation
    //    issue. Guarded by pmsPaymentId so a re-run doesn't double-record.
    if (
      booking.rateType === "nr" &&
      booking.stripePaymentIntentId &&
      !booking.pmsPaymentId
    ) {
      try {
        const { pmsPaymentId } = await pms.recordPayment({
          reservationId: pmsReservationId,
          amount: grandTotalNum,
          type: "credit",
          description: `Stripe ${booking.stripePaymentIntentId}`,
          externalIdentifier: booking.stripePaymentIntentId,
        });
        if (pmsPaymentId) {
          await db
            .update(bookings)
            .set({ pmsPaymentId })
            .where(eq(bookings.id, booking.id));
        }
      } catch (payErr) {
        console.error(
          `PMS-retry recordPayment failed for ${pmsReservationId}:`,
          payErr
        );
      }
    }

    // Now that the booking actually exists in the PMS, send the confirmation
    // that the inline path never got to send.
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
        // Template-driven email — booking-confirmation delegates to sendTemplate.
        // No nightly/extras line detail rendered (the template doesn't use
        // those vars); the recovery cron only restores the reservation, not
        // the folio line-item history. Hotel can fix extras manually.
        await sendBookingConfirmationEmail({
          propertyId: property.id,
          bookingId: booking.id,
          to: booking.guestEmail,
          guestFirstName: booking.guestFirst,
          guestLastName: booking.guestLast,
          hotelName: property.name,
          cloudbedsReservationId: pmsReservationId,
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
      cloudbedsReservationId: pmsReservationId,
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
