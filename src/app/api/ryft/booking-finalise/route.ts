import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getPaymentSession,
  getCustomerPaymentMethods,
} from "@/lib/ryft/sessions";
import { fulfilBooking } from "@/lib/pms/fulfil-booking";

// Inline finalise after the guest confirms the card in the browser — the Ryft
// analog of the Stripe submitBooking finalise. Verifies the Ryft session
// server-side (never trust the client) and fulfils to the PMS synchronously so
// the confirmation page can show the reservation. The Ryft webhook is the
// durable backstop if the tab dies here; fulfilBooking is idempotent.
//
// Two rate types:
//   - NR: the pay-now session must be Approved/Captured → mark paid → fulfil
//     (fulfilBooking records the folio payment for NR).
//   - Flex: the card-save (verify) session must be Approved → persist the saved
//     pmt_ so the auto-charge cron can charge it later → fulfil (no payment
//     recorded now; the cron does it at charge time).

export async function POST(req: NextRequest) {
  const { bookingId } = (await req.json().catch(() => ({}))) as {
    bookingId?: string;
  };
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  const isFlex = booking.rateType === "flex";
  const sessionId = isFlex
    ? booking.ryftVerifySessionId
    : booking.ryftPaymentSessionId;
  if (!sessionId) {
    return NextResponse.json(
      { error: "Booking has no Ryft session" },
      { status: 409 }
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId!))
    .limit(1);
  if (!property?.ryftAccountId) {
    return NextResponse.json(
      { error: "Property is not Ryft-active" },
      { status: 409 }
    );
  }

  // Verify with Ryft directly — the sub-account is the merchant of record. NR
  // captures (Approved/Captured); a Flex card-save verification resolves to
  // Approved (zero amount, nothing to capture).
  let verified = false;
  let savedCardId: string | undefined;
  try {
    const session = await getPaymentSession(sessionId, property.ryftAccountId);
    verified =
      session.status === "Approved" || session.status === "Captured";
    // The verify session carries the exact card it saved — prefer it over the
    // customer's payment-method list (a reused customer can hold several cards).
    const tokenized = session.paymentMethod?.tokenizedDetails;
    if (tokenized?.stored) savedCardId = tokenized.id;
  } catch (err) {
    console.error("Ryft finalise: session fetch failed:", err);
    return NextResponse.json(
      { error: "Could not verify payment" },
      { status: 502 }
    );
  }

  if (!verified) {
    return NextResponse.json(
      { error: isFlex ? "Card was not saved" : "Payment not completed" },
      { status: 402 }
    );
  }

  // Flex: resolve and persist the saved card so the auto-charge cron can charge
  // it off-session later. Without a pmt_ the booking can never be charged, so
  // this is a hard failure (the guest must retry the card).
  if (isFlex && !booking.ryftPaymentMethodId) {
    if (!booking.ryftCustomerId) {
      return NextResponse.json(
        { error: "Card save incomplete (no customer)" },
        { status: 409 }
      );
    }
    try {
      // Prefer the card the session reported; fall back to the customer's most
      // recent saved card (Ryft lists newest-first) if the session omitted it.
      let pmt = savedCardId;
      if (!pmt) {
        const methods = await getCustomerPaymentMethods(
          booking.ryftCustomerId,
          property.ryftAccountId
        );
        pmt = methods[0]?.id;
      }
      if (!pmt) {
        return NextResponse.json(
          { error: "Card was not saved" },
          { status: 402 }
        );
      }
      await db
        .update(bookings)
        .set({ ryftPaymentMethodId: pmt })
        .where(eq(bookings.id, booking.id));
    } catch (err) {
      console.error("Ryft finalise: payment-method fetch failed:", err);
      return NextResponse.json(
        { error: "Could not confirm saved card" },
        { status: 502 }
      );
    }
  }

  // NR is paid now; Flex is authorised (card saved), charged later — leave its
  // status to flow through fulfil (pms_synced) so the cron picks it up.
  if (!isFlex && booking.status === "pending") {
    await db
      .update(bookings)
      .set({ status: "paid" })
      .where(eq(bookings.id, booking.id));
  }

  const result = await fulfilBooking(booking.id);

  return NextResponse.json({
    bookingId: booking.id,
    orderId: booking.orderId,
    outcome: result.outcome,
    cloudbedsReservationId: result.pmsReservationId ?? null,
  });
}
