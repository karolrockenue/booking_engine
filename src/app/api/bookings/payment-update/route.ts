import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, paymentEvents, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaymentUpdateToken } from "@/lib/crypto";
import { getStripe } from "@/lib/stripe/client";
import { detachPaymentMethod } from "@/lib/stripe/detach";
import {
  getPaymentSession,
  getCustomerPaymentMethods,
  deletePaymentMethod,
} from "@/lib/ryft/sessions";

interface PaymentUpdateBody {
  token: string;
  // Stripe path verifies a fresh SetupIntent; Ryft path verifies a fresh
  // card-save (verifyAccount) session. Exactly one is sent per request.
  setupIntentId?: string;
  ryftVerifySessionId?: string;
}

// Guest finished re-auth on /payment-update/[token]. We verify the
// SetupIntent succeeded server-side, swap the saved PM on the booking, and
// reset the auto-charge state so the next cron run retries with the fresh
// card.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PaymentUpdateBody | null;
  if (!body?.token || (!body?.setupIntentId && !body?.ryftVerifySessionId)) {
    return NextResponse.json(
      { error: "token and a card-update session id required" },
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

  // Ryft path: verify the fresh card-save (verifyAccount) session saved a card,
  // swap it onto the booking as the new COF mandate, drop the old card, and
  // re-arm the auto-charge cron. The Stripe SetupIntent path follows below.
  if (body.ryftVerifySessionId) {
    return handleRyftUpdate(booking, body.ryftVerifySessionId);
  }

  // Stripe path — validation guarantees a setupIntentId when no Ryft session.
  if (!body.setupIntentId) {
    return NextResponse.json(
      { error: "setupIntentId required" },
      { status: 400 }
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

type Booking = typeof bookings.$inferSelect;

// Ryft re-enter-card: verify the new card-save session, adopt its saved card +
// the session itself as the booking's COF mandate, drop the old card, and reset
// the auto-charge state so the next cron run retries with the fresh card.
async function handleRyftUpdate(
  booking: Booking,
  verifySessionId: string
): Promise<NextResponse> {
  if (!booking.ryftCustomerId) {
    return NextResponse.json(
      { error: "Booking is not a Ryft card-save booking" },
      { status: 409 }
    );
  }

  const [property] = booking.propertyId
    ? await db
        .select()
        .from(properties)
        .where(eq(properties.id, booking.propertyId))
        .limit(1)
    : [undefined];
  if (!property?.ryftAccountId || property.ryftAccountStatus !== "active") {
    return NextResponse.json(
      { error: "Property is not Ryft-active" },
      { status: 409 }
    );
  }
  const account = property.ryftAccountId;

  // Verify the new mandate session with Ryft directly — never trust the client.
  // A zero-value verifyAccount session resolves to Approved; the card it saved
  // rides on tokenizedDetails (gated on `stored`).
  let newPmt: string | undefined;
  try {
    const session = await getPaymentSession(verifySessionId, account);
    if (session.status !== "Approved" && session.status !== "Captured") {
      return NextResponse.json(
        { error: `Card was not saved (${session.status})` },
        { status: 402 }
      );
    }
    // The session must belong to this booking's customer — stops a leaked link
    // arming a stranger's card.
    if (session.customerId && session.customerId !== booking.ryftCustomerId) {
      return NextResponse.json(
        { error: "Card-save session customer mismatch" },
        { status: 403 }
      );
    }
    const tokenized = session.paymentMethod?.tokenizedDetails;
    if (tokenized?.stored) newPmt = tokenized.id;
    if (!newPmt) {
      // Fall back to the customer's most recent saved card (Ryft lists
      // newest-first) if the session omitted it.
      const methods = await getCustomerPaymentMethods(
        booking.ryftCustomerId,
        account
      );
      newPmt = methods[0]?.id;
    }
  } catch (err) {
    console.error(
      `payment-update: Ryft session verify failed for ${verifySessionId}:`,
      err
    );
    return NextResponse.json(
      { error: "Could not verify card update" },
      { status: 502 }
    );
  }
  if (!newPmt) {
    return NextResponse.json({ error: "Card was not saved" }, { status: 402 });
  }

  // Drop the old saved card so it can't be charged again. Best-effort — a
  // single-use or already-gone card just throws, which is fine.
  const oldPmt = booking.ryftPaymentMethodId;
  if (oldPmt && oldPmt !== newPmt) {
    await deletePaymentMethod(oldPmt, account).catch((e) =>
      console.error(
        `payment-update: failed to delete old Ryft card ${oldPmt} for booking ${booking.id}:`,
        e
      )
    );
  }

  // Charge in ~5 minutes so the next cron run picks it up. Swap BOTH the saved
  // card and the verify session: the MIT charge uses the verify session as its
  // previousPayment (the COF mandate), so the new card must charge under its own
  // new mandate.
  const nextChargeAt = new Date(Date.now() + 5 * 60 * 1000);
  await db
    .update(bookings)
    .set({
      ryftPaymentMethodId: newPmt,
      ryftVerifySessionId: verifySessionId,
      autoChargeAttempts: 0,
      firstAutoChargeFailureAt: null,
      chargeAt: nextChargeAt,
    })
    .where(eq(bookings.id, booking.id));

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "setup_intent_succeeded",
    ryftId: verifySessionId,
    status: "payment_method_updated",
  });

  return NextResponse.json({ success: true });
}
