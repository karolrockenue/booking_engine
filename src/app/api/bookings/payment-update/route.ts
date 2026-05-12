import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, paymentEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaymentUpdateToken } from "@/lib/crypto";
import { getStripe } from "@/lib/stripe/client";
import { detachPaymentMethod } from "@/lib/stripe/detach";

interface PaymentUpdateBody {
  token: string;
  setupIntentId: string;
}

// Guest finished re-auth on /payment-update/[token]. We verify the
// SetupIntent succeeded server-side, swap the saved PM on the booking, and
// reset the auto-charge state so the next cron run retries with the fresh
// card.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PaymentUpdateBody | null;
  if (!body?.token || !body?.setupIntentId) {
    return NextResponse.json(
      { error: "token and setupIntentId required" },
      { status: 400 }
    );
  }

  const verified = verifyPaymentUpdateToken(body.token);
  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, verified.bookingId))
    .limit(1);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Only act on bookings still awaiting auto-charge. Paid/cancelled/failed
  // are terminal — silently refuse so a leaked link can't reset state.
  if (booking.status !== "pms_synced") {
    return NextResponse.json(
      { error: "Booking not eligible for payment update" },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  let setupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(body.setupIntentId);
  } catch (err) {
    console.error(
      `payment-update: SetupIntent retrieve failed for ${body.setupIntentId}:`,
      err
    );
    return NextResponse.json(
      { error: "Could not verify card update" },
      { status: 502 }
    );
  }
  if (setupIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: `SetupIntent not succeeded: ${setupIntent.status}` },
      { status: 409 }
    );
  }
  // Refuse if the SI isn't attached to this booking's customer — prevents
  // a leaked token from arming a stranger's card.
  if (
    booking.stripeCustomerId &&
    setupIntent.customer &&
    setupIntent.customer !== booking.stripeCustomerId
  ) {
    return NextResponse.json(
      { error: "SetupIntent customer mismatch" },
      { status: 403 }
    );
  }
  const newPaymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;
  if (!newPaymentMethodId) {
    return NextResponse.json(
      { error: "SetupIntent has no payment method" },
      { status: 409 }
    );
  }

  // Detach the old PM so it can't be charged again. Best-effort — if it's
  // already gone or Stripe refuses, swallow and continue.
  const oldPm = booking.stripePaymentMethodId;
  if (oldPm && oldPm !== newPaymentMethodId) {
    await detachPaymentMethod(oldPm).catch((e) =>
      console.error(
        `payment-update: failed to detach old PM ${oldPm} for booking ${booking.id}:`,
        e
      )
    );
  }

  // Charge the new card in ~5 minutes so the next cron run picks it up. We
  // intentionally don't charge inline — keeps this endpoint fast, and the
  // cron path is the canonical retry path.
  const nextChargeAt = new Date(Date.now() + 5 * 60 * 1000);
  await db
    .update(bookings)
    .set({
      stripePaymentMethodId: newPaymentMethodId,
      stripeSetupIntentId: body.setupIntentId,
      autoChargeAttempts: 0,
      firstAutoChargeFailureAt: null,
      chargeAt: nextChargeAt,
    })
    .where(eq(bookings.id, booking.id));

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "setup_intent_succeeded",
    stripeId: setupIntent.id,
    status: "payment_method_updated",
  });

  return NextResponse.json({ success: true });
}
