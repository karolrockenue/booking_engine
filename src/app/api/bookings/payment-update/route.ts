import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, paymentEvents, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaymentUpdateToken } from "@/lib/crypto";
import {
  getPaymentSession,
  getCustomerPaymentMethods,
  deletePaymentMethod,
} from "@/lib/ryft/sessions";

interface PaymentUpdateBody {
  token: string;
  // The fresh card-save (verifyAccount) session the guest just completed.
  ryftVerifySessionId: string;
}

// Guest finished re-entering a card on /payment-update/[token]. We verify the
// card-save session server-side, swap the saved card onto the booking, and
// reset the auto-charge state so the next cron run retries with the fresh card.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PaymentUpdateBody | null;
  if (!body?.token || !body?.ryftVerifySessionId) {
    return NextResponse.json(
      { error: "token and ryftVerifySessionId required" },
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

  return handleRyftUpdate(booking, body.ryftVerifySessionId);
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
    type: "card_save_succeeded",
    ryftId: verifySessionId,
    status: "payment_method_updated",
  });

  return NextResponse.json({ success: true });
}
