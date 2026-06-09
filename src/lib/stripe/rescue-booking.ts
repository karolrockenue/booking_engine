// Webhook-driven rescue of a create-before-pay booking (Step 0b).
//
// With create-before-pay the booking row already exists at "pending" when the
// card is confirmed. If the browser dies after the charge but before the
// finalise call, Stripe's payment_intent.succeeded / setup_intent.succeeded is
// the reliable, browser-independent signal that lets us finish the job. Before
// fulfilling we:
//   1. Backfill any Stripe state the finalise call never delivered — critically
//      the Flex saved payment method, without which the auto-charge cron can't
//      collect (it skips on missing stripePaymentMethodId).
//   2. Flip pending → paid/payment_authorized now that Stripe confirms payment.
//      Details were patched BEFORE the charge, so the row is complete. This also
//      makes the row eligible for the retry cron if the immediate rescue below
//      is age-gated (the cron only picks paid/payment_authorized rows).
//
// Lives here (not in the webhook route) so it's unit-testable and the smoke
// exercises the exact same code the webhook runs.

import type Stripe from "stripe";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fulfilBooking } from "@/lib/pms/fulfil-booking";

// Don't fulfil from the webhook while the inline finalise call may still be
// running — it's the primary fulfiller and returns the reservation # to the
// guest. Only rescue bookings older than this (the webhook re-delivers, or the
// browser died), matching the retry cron's min-age. fulfilBooking is claim-
// locked + idempotent regardless, so this just avoids a needless race.
export const WEBHOOK_FULFIL_MIN_AGE_MS = 60 * 1000;

function idOf(
  ref: string | { id: string } | null | undefined
): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

export async function rescueStuckBooking(
  kind: "payment" | "setup",
  intent: Stripe.PaymentIntent | Stripe.SetupIntent
): Promise<void> {
  const orderId = (intent.metadata?.orderId as string | undefined) ?? null;
  if (!orderId) return;
  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      reservationId: bookings.cloudbedsReservationId,
      createdAt: bookings.createdAt,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeSetupIntentId: bookings.stripeSetupIntentId,
      stripePaymentMethodId: bookings.stripePaymentMethodId,
      stripeCustomerId: bookings.stripeCustomerId,
    })
    .from(bookings)
    .where(eq(bookings.orderId, orderId))
    .limit(1);
  if (!booking) return; // row not written yet — inline path / cron will handle
  if (booking.reservationId) return; // already fulfilled
  if (booking.status === "cancelled" || booking.status === "failed") return;

  // Backfill missing Stripe ids + flip out of pending (never downgrade a row
  // the finalise call already advanced).
  const patch: Partial<typeof bookings.$inferInsert> = {};
  if (booking.status === "pending") {
    patch.status = kind === "payment" ? "paid" : "payment_authorized";
  }
  if (kind === "payment") {
    if (!booking.stripePaymentIntentId) patch.stripePaymentIntentId = intent.id;
  } else {
    const si = intent as Stripe.SetupIntent;
    if (!booking.stripeSetupIntentId) patch.stripeSetupIntentId = si.id;
    const pm = idOf(si.payment_method);
    if (!booking.stripePaymentMethodId && pm) patch.stripePaymentMethodId = pm;
    const cust = idOf(si.customer);
    if (!booking.stripeCustomerId && cust) patch.stripeCustomerId = cust;
  }
  if (Object.keys(patch).length > 0) {
    await db.update(bookings).set(patch).where(eq(bookings.id, booking.id));
  }

  const ageMs = booking.createdAt
    ? Date.now() - new Date(booking.createdAt).getTime()
    : Infinity;
  if (ageMs < WEBHOOK_FULFIL_MIN_AGE_MS) return; // let the inline path go first
  void fulfilBooking(booking.id).catch((e) =>
    console.error(`webhook rescue fulfilBooking failed for ${booking.id}:`, e)
  );
}
