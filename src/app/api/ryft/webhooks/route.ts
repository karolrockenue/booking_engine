import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, paymentEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyRyftSignature,
  RYFT_SIGNATURE_HEADER,
  RyftEvent,
  type RyftWebhookEvent,
} from "@/lib/ryft/webhook";
import { fulfilBooking } from "@/lib/pms/fulfil-booking";

// Ryft webhook receiver — the durable backstop that turns a confirmed Ryft
// payment into a fulfilled booking (reservation + folio payment in the PMS),
// the Ryft analog of /api/stripe/webhooks. Ryft signs the RAW body (HMAC-SHA256,
// `Signature` header) so we must read req.text() and verify before parsing.
//
// On a successful pay-now session (PaymentSession.approved/captured) we stamp
// the session id onto the booking and run fulfilBooking(), which is idempotent
// — safe to fire on both events and alongside the inline/cron triggers.

// The subset of the Ryft PaymentSession resource we read off `event.data`.
interface RyftPaymentSessionPayload {
  id?: string;
  amount?: number; // minor units
  currency?: string;
  status?: string;
  metadata?: { orderId?: string; propertyId?: string };
}

export async function POST(req: NextRequest) {
  const secret = process.env.RYFT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RYFT_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  const sig = req.headers.get(RYFT_SIGNATURE_HEADER);
  const body = await req.text();
  if (!verifyRyftSignature(body, sig, secret)) {
    console.error("Ryft webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RyftWebhookEvent;
  try {
    event = JSON.parse(body) as RyftWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (event.eventType) {
      case RyftEvent.PaymentApproved:
      case RyftEvent.PaymentCaptured:
        await handlePaymentSucceeded(event);
        break;
      case RyftEvent.PaymentDeclined:
        await logPaymentEvent(event, "payment_session_declined");
        break;
      default:
        // Account.*, Dispute.*, Payout.*, Person.* — not needed for the
        // pay-now → fulfil path yet; acknowledged so Ryft stops retrying.
        break;
    }
  } catch (err) {
    console.error(`Ryft webhook handler error (${event.eventType}):`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Look up the booking via the orderId we stamped into session metadata. Returns
// null if the booking row doesn't exist yet (webhook can race ahead of the
// create-before-pay row); we still log the event so it can be reconciled.
async function bookingForOrderId(orderId: string | null | undefined) {
  if (!orderId) return null;
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, orderId))
    .limit(1);
  return booking ?? null;
}

async function handlePaymentSucceeded(event: RyftWebhookEvent) {
  const session = (event.data ?? {}) as RyftPaymentSessionPayload;
  const booking = await bookingForOrderId(session.metadata?.orderId);

  await logPaymentEvent(event, "payment_session_approved", booking?.id ?? null);

  if (!booking) {
    console.warn(
      `Ryft ${event.eventType} for unknown order ${session.metadata?.orderId}`
    );
    return;
  }

  // Stamp the session id (idempotent) and mark paid so fulfilBooking's payment
  // step posts the Ryft reference to the PMS folio.
  await db
    .update(bookings)
    .set({
      ryftPaymentSessionId: booking.ryftPaymentSessionId ?? session.id ?? null,
      status: booking.status === "pending" ? "paid" : booking.status,
    })
    .where(eq(bookings.id, booking.id));

  await fulfilBooking(booking.id);
}

async function logPaymentEvent(
  event: RyftWebhookEvent,
  type: string,
  bookingId?: string | null
) {
  const session = (event.data ?? {}) as RyftPaymentSessionPayload;
  const resolvedBookingId =
    bookingId !== undefined
      ? bookingId
      : (await bookingForOrderId(session.metadata?.orderId))?.id ?? null;

  await db.insert(paymentEvents).values({
    bookingId: resolvedBookingId,
    type,
    ryftId: session.id ?? null,
    amount:
      typeof session.amount === "number"
        ? (session.amount / 100).toFixed(2)
        : null,
    currency: session.currency ?? null,
    status: session.status ?? null,
    payload: event as unknown as Record<string, unknown>,
  });
}
