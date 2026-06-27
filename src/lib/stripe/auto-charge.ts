import Stripe from "stripe";
import { db } from "@/db";
import {
  bookings,
  paymentEvents,
  properties,
  ratePlans,
  roomTypes,
} from "@/db/schema";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { getStripe, publicOrigin } from "./client";
import { toMinorUnits } from "./amounts";
import { getPmsAdapter } from "@/lib/pms";
import { detachPaymentMethod } from "./detach";
import { signPaymentUpdateToken } from "@/lib/crypto";
import { sendPaymentUpdateEmail } from "@/lib/email/payment-update";
import { sendBookingCancellationEmail } from "@/lib/email/booking-cancellation";

// Phase 5 auto-charge. Cron picks up Flex bookings whose cancellation window
// has closed (chargeAt <= now) and creates an off-session PaymentIntent
// against the customer + saved payment method. Direct charge on the connected
// account with application_fee + on_behalf_of, mirroring the NR checkout
// path.
//
// On failure, firstAutoChargeFailureAt anchors a 24h grace window. The cron
// keeps retrying hourly inside the window. Auto-cancel after the window is
// the next step (Phase 5 step 6) — for now we just log and let the next
// run try again.

const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;

type Booking = typeof bookings.$inferSelect;

export type AutoChargeOutcome =
  | "charged"
  | "failed"
  | "skipped"
  | "grace_expired";

export interface AutoChargeResult {
  bookingId: string;
  outcome: AutoChargeOutcome;
  reason?: string;
  paymentIntentId?: string;
  errorCode?: string;
}

export async function findEligibleBookings(): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.rateType, "flex"),
        eq(bookings.status, "pms_synced"),
        // Stripe rail only — a Flex booking on Ryft has a saved Ryft card but no
        // Stripe customer, and is handled by ryft/auto-charge.ts. Keying off
        // stripeCustomerId keeps the two sweeps from both claiming a booking.
        isNotNull(bookings.stripeCustomerId),
        isNotNull(bookings.chargeAt),
        lte(bookings.chargeAt, sql`NOW()`)
      )
    )
    .limit(100);
}

export async function chargeBooking(
  booking: Booking
): Promise<AutoChargeResult> {
  // Grace window check first. Once 24h has passed since the first failure
  // we stop trying to charge and unwind the booking: cancel in Cloudbeds,
  // detach the saved card, mark cancelled, email the guest.
  if (
    booking.firstAutoChargeFailureAt &&
    Date.now() - booking.firstAutoChargeFailureAt.getTime() > GRACE_WINDOW_MS
  ) {
    return autoCancelAfterGrace(booking);
  }

  if (
    !booking.propertyId ||
    !booking.stripeCustomerId ||
    !booking.stripePaymentMethodId ||
    !booking.cloudbedsReservationId
  ) {
    return {
      bookingId: booking.id,
      outcome: "skipped",
      reason: "missing_stripe_or_cb_state",
    };
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId))
    .limit(1);
  // Cloudbeds needs a resolved property id; Mews acts via its stored creds.
  if (
    !property?.stripeAccountId ||
    (property.pmsType !== "mews" && !property.cloudbedsPropertyId)
  ) {
    return {
      bookingId: booking.id,
      outcome: "skipped",
      reason: "property_not_connected",
    };
  }

  // Bump attempt counter before the call so a hang/crash doesn't leave it
  // un-incremented (which would otherwise mean infinite retries on the same
  // idempotency key).
  const nextAttempt = (booking.autoChargeAttempts ?? 0) + 1;
  await db
    .update(bookings)
    .set({ autoChargeAttempts: nextAttempt })
    .where(eq(bookings.id, booking.id));

  const grandTotalNum = Number(booking.grandTotal);
  const totalMinor = toMinorUnits(grandTotalNum, booking.currency);
  const feePercent = Number(property.platformFeePercent ?? "3.00");
  const applicationFeeAmount = Math.round((totalMinor * feePercent) / 100);

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "auto_charge_attempt",
    amount: grandTotalNum.toFixed(2),
    currency: booking.currency,
    status: String(nextAttempt),
  });

  const stripe = getStripe();
  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount: totalMinor,
        currency: booking.currency.toLowerCase(),
        customer: booking.stripeCustomerId,
        payment_method: booking.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        application_fee_amount: applicationFeeAmount,
        on_behalf_of: property.stripeAccountId,
        transfer_data: { destination: property.stripeAccountId },
        metadata: {
          orderId: booking.orderId,
          bookingId: booking.id,
          attempt: String(nextAttempt),
        },
      },
      {
        // Per-attempt idempotency. A new key per attempt lets us retry after
        // a failure; same key inside one attempt collapses duplicate calls
        // (e.g. cron run overlap) to a single Stripe action.
        idempotencyKey: `ac_${booking.orderId}_${nextAttempt}`,
      }
    );

    if (pi.status !== "succeeded") {
      // requires_action (SCA) or requires_payment_method without throwing —
      // surface as a soft failure so the re-auth/email path picks it up.
      throw new Error(`PaymentIntent status ${pi.status}`);
    }

    // Record the charge in the PMS folio. Best-effort — money is at Stripe;
    // missing folio line is a reconciliation issue the hotel can fix.
    try {
      await getPmsAdapter(property).recordPayment({
        reservationId: booking.cloudbedsReservationId,
        amount: grandTotalNum,
        type: "credit",
        description: `Stripe ${pi.id} (auto-charge)`,
        externalIdentifier: pi.id,
      });
    } catch (payErr) {
      console.error(
        `Auto-charge postPayment failed for reservation ${booking.cloudbedsReservationId}:`,
        payErr
      );
    }

    await db
      .update(bookings)
      .set({ status: "paid", stripePaymentIntentId: pi.id })
      .where(eq(bookings.id, booking.id));

    await db.insert(paymentEvents).values({
      bookingId: booking.id,
      type: "auto_charge_succeeded",
      stripeId: pi.id,
      amount: grandTotalNum.toFixed(2),
      currency: booking.currency,
      status: pi.status,
      payload: pi as unknown as Record<string, unknown>,
    });

    return {
      bookingId: booking.id,
      outcome: "charged",
      paymentIntentId: pi.id,
    };
  } catch (err) {
    // Stripe.errors.StripeError is a value (the class), so we describe the
    // shape we read off it as a structural type rather than the class type.
    const stripeErr = err as {
      code?: string;
      message?: string;
      payment_intent?: Stripe.PaymentIntent;
    };
    const errorCode = stripeErr.code ?? "unknown";
    const errorMessage =
      stripeErr.message ?? (err instanceof Error ? err.message : "Unknown");

    await db
      .update(bookings)
      .set({
        firstAutoChargeFailureAt: booking.firstAutoChargeFailureAt ?? new Date(),
      })
      .where(eq(bookings.id, booking.id));

    await db.insert(paymentEvents).values({
      bookingId: booking.id,
      type: "auto_charge_failed",
      stripeId: stripeErr.payment_intent?.id,
      amount: grandTotalNum.toFixed(2),
      currency: booking.currency,
      status: "failed",
      errorCode,
      errorMessage,
    });

    console.error(
      `Auto-charge attempt ${nextAttempt} failed for booking ${booking.id}: ${errorCode} — ${errorMessage}`
    );

    // Re-auth email is only useful when the bank needs the guest to act
    // (3DS challenge). Send once per booking — guarded by the absence of a
    // prior firstAutoChargeFailureAt at entry, which means this is the first
    // failure we're recording.
    if (
      !booking.firstAutoChargeFailureAt &&
      errorCode === "authentication_required"
    ) {
      void sendReAuthEmail(booking).catch((e) =>
        console.error(`Re-auth email failed for booking ${booking.id}:`, e)
      );
    }

    return {
      bookingId: booking.id,
      outcome: "failed",
      reason: errorMessage,
      errorCode,
    };
  }
}

async function autoCancelAfterGrace(
  booking: Booking
): Promise<AutoChargeResult> {
  if (!booking.propertyId || !booking.cloudbedsReservationId) {
    // Without a CB reservation there's nothing to cancel — but we still
    // want to terminate this booking so the cron stops picking it up.
    await db
      .update(bookings)
      .set({ status: "cancelled" })
      .where(eq(bookings.id, booking.id));
    return {
      bookingId: booking.id,
      outcome: "grace_expired",
      reason: "no_cb_reservation",
    };
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId))
    .limit(1);
  // Cloudbeds needs a resolved property id to act; Mews acts via its stored
  // credentials (no cloudbedsPropertyId). Only block the Cloudbeds case.
  if (property?.pmsType !== "mews" && !property?.cloudbedsPropertyId) {
    return {
      bookingId: booking.id,
      outcome: "grace_expired",
      reason: "property_not_connected",
    };
  }

  // Cancel in the PMS first. If it fails we abort and let the next cron run
  // retry — better to leave the room held than to detach the card and
  // strand the reservation.
  try {
    await getPmsAdapter(property).cancelReservation({
      reservationId: booking.cloudbedsReservationId,
      reason: "auto_cancel_grace_expired",
    });
  } catch (err) {
    console.error(
      `Auto-cancel CB failed for booking ${booking.id}:`,
      err
    );
    return {
      bookingId: booking.id,
      outcome: "grace_expired",
      reason: "cb_cancel_failed",
    };
  }

  // Detach the saved PM so it can't be re-charged later. Best-effort.
  if (booking.stripePaymentMethodId) {
    const result = await detachPaymentMethod(
      booking.stripePaymentMethodId
    ).catch((e) => {
      console.error(
        `Auto-cancel detach failed for booking ${booking.id}:`,
        e
      );
      return null;
    });
    if (result) {
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "payment_method_detached",
        stripeId: booking.stripePaymentMethodId,
        status: result.alreadyDetached
          ? "already_detached_after_grace"
          : "detached_after_grace",
      });
    }
  }

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, booking.id));

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "auto_charge_failed",
    status: "auto_cancelled_after_grace",
  });

  // Fire-and-forget cancellation email. refunded: false because no charge
  // ever succeeded.
  void (async () => {
    const [room] = booking.roomTypeId
      ? await db
          .select()
          .from(roomTypes)
          .where(eq(roomTypes.id, booking.roomTypeId))
          .limit(1)
      : [undefined];
    const [rate] = booking.ratePlanId
      ? await db
          .select()
          .from(ratePlans)
          .where(eq(ratePlans.id, booking.ratePlanId))
          .limit(1)
      : [undefined];
    try {
      await sendBookingCancellationEmail({
        propertyId: property.id,
        bookingId: booking.id,
        to: booking.guestEmail,
        guestFirstName: booking.guestFirst,
        guestLastName: booking.guestLast,
        hotelName: property.name,
        cloudbedsReservationId: booking.cloudbedsReservationId!,
        orderId: booking.orderId,
        roomName: room?.name ?? "Room",
        rateName: rate?.name ?? "Rate",
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        currency: booking.currency,
        refunded: false,
      });
    } catch (emailErr) {
      console.error(
        `Auto-cancel email failed for booking ${booking.id}:`,
        emailErr
      );
    }
  })();

  return {
    bookingId: booking.id,
    outcome: "grace_expired",
    reason: "cancelled_after_grace",
  };
}

async function sendReAuthEmail(booking: Booking): Promise<void> {
  const [property] = booking.propertyId
    ? await db
        .select()
        .from(properties)
        .where(eq(properties.id, booking.propertyId))
        .limit(1)
    : [];
  if (!property) return;

  const token = signPaymentUpdateToken(booking.id);
  await sendPaymentUpdateEmail({
    to: booking.guestEmail,
    guestFirstName: booking.guestFirst,
    hotelName: property.name,
    cloudbedsReservationId: booking.cloudbedsReservationId ?? booking.orderId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    currency: booking.currency,
    grandTotal: Number(booking.grandTotal),
    paymentUpdateUrl: `${publicOrigin()}/payment-update/${token}`,
  });

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "auto_charge_failed",
    status: "re_auth_email_sent",
  });
}
