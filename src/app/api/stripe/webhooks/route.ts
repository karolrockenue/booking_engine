import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { properties, bookings, paymentEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/client";
import { resolveStripeAccountStatus } from "@/lib/stripe/status";
import { rescueStuckBooking } from "@/lib/stripe/rescue-booking";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        await logPaymentIntentEvent(event.type, pi);
        if (event.type === "payment_intent.succeeded") {
          await rescueStuckBooking("payment", pi);
        }
        break;
      }
      case "setup_intent.succeeded":
      case "setup_intent.setup_failed": {
        const si = event.data.object as Stripe.SetupIntent;
        await logSetupIntentEvent(event.type, si);
        if (event.type === "setup_intent.succeeded") {
          await rescueStuckBooking("setup", si);
        }
        break;
      }
      default:
        // Future: charge.refunded, payment_method.detached land in Step 16.
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler error (${event.type}):`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleAccountUpdated(account: Stripe.Account) {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.stripeAccountId, account.id))
    .limit(1);

  if (!property) {
    console.warn(`account.updated for unknown account ${account.id}`);
    return;
  }

  const { status, currency } = resolveStripeAccountStatus(
    account,
    property.currency
  );

  await db
    .update(properties)
    .set({
      stripeAccountStatus: status,
      stripeAccountCurrency: currency,
    })
    .where(eq(properties.id, property.id));
}

// Look up the booking by orderId metadata. Returns null if booking doesn't
// exist yet (webhook can fire before /api/bookings completes — that's fine,
// we still log the event with bookingId=null and can backfill later).
async function bookingIdForOrderId(orderId: string | null): Promise<string | null> {
  if (!orderId) return null;
  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.orderId, orderId))
    .limit(1);
  return booking?.id ?? null;
}

async function logPaymentIntentEvent(
  type: "payment_intent.succeeded" | "payment_intent.payment_failed",
  pi: Stripe.PaymentIntent
) {
  const orderId = (pi.metadata?.orderId as string | undefined) ?? null;
  const bookingId = await bookingIdForOrderId(orderId);

  await db.insert(paymentEvents).values({
    bookingId,
    type:
      type === "payment_intent.succeeded"
        ? "payment_intent_succeeded"
        : "payment_intent_failed",
    stripeId: pi.id,
    amount: (pi.amount / 100).toFixed(2),
    currency: pi.currency,
    status: pi.status,
    errorCode: pi.last_payment_error?.code ?? null,
    errorMessage: pi.last_payment_error?.message ?? null,
    payload: pi as unknown as Record<string, unknown>,
  });
}

async function logSetupIntentEvent(
  type: "setup_intent.succeeded" | "setup_intent.setup_failed",
  si: Stripe.SetupIntent
) {
  const orderId = (si.metadata?.orderId as string | undefined) ?? null;
  const bookingId = await bookingIdForOrderId(orderId);

  await db.insert(paymentEvents).values({
    bookingId,
    type:
      type === "setup_intent.succeeded"
        ? "setup_intent_succeeded"
        : "setup_intent_failed",
    stripeId: si.id,
    amount: null,
    currency: null,
    status: si.status,
    errorCode: si.last_setup_error?.code ?? null,
    errorMessage: si.last_setup_error?.message ?? null,
    payload: si as unknown as Record<string, unknown>,
  });
}
