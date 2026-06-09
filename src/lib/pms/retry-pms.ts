import { db } from "@/db";
import { bookings, paymentEvents } from "@/db/schema";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/client";
import { detachPaymentMethod } from "@/lib/stripe/detach";
import { fulfilBooking } from "./fulfil-booking";

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

  // Delegate to the shared idempotent fulfilment unit (create-or-adopt +
  // extras + external payment + confirmation email + status). It claim-locks
  // the booking, so this never races the inline path or the Stripe webhook.
  const result = await fulfilBooking(booking.id);
  switch (result.outcome) {
    case "synced":
      return {
        bookingId: booking.id,
        outcome: "synced",
        cloudbedsReservationId: result.pmsReservationId,
      };
    case "sold_out":
      // The room sold out before we could create it. Nothing to retry — let the
      // attempt counter run to MAX so giveUpAndUnwind refunds/detaches.
      return {
        bookingId: booking.id,
        outcome: "retry_failed",
        reason: "sold_out",
      };
    default:
      console.error(
        `PMS-retry attempt ${nextAttempt}/${MAX_ATTEMPTS} for booking ${booking.id}: ${result.outcome} (${result.reason ?? ""})`
      );
      return {
        bookingId: booking.id,
        outcome: "retry_failed",
        reason: result.reason ?? result.outcome,
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
