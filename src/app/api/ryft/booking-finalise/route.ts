import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPaymentSession } from "@/lib/ryft/sessions";
import { fulfilBooking } from "@/lib/pms/fulfil-booking";

// Inline finalise after the guest confirms the card in the browser — the Ryft
// analog of the Stripe submitBooking finalise. Verifies the Ryft session is
// actually paid (never trust the client), marks the booking paid, and fulfils
// to the PMS synchronously so the confirmation page can show the reservation.
// The Ryft webhook (PaymentSession.approved/captured) is the durable backstop
// if the tab dies here; fulfilBooking is idempotent so both can run safely.

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
  if (!booking.ryftPaymentSessionId) {
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

  // Verify with Ryft directly — the sub-account is the merchant of record.
  let paid = false;
  try {
    const session = await getPaymentSession(
      booking.ryftPaymentSessionId,
      property.ryftAccountId
    );
    paid = session.status === "Approved" || session.status === "Captured";
  } catch (err) {
    console.error("Ryft finalise: session fetch failed:", err);
    return NextResponse.json(
      { error: "Could not verify payment" },
      { status: 502 }
    );
  }

  if (!paid) {
    return NextResponse.json(
      { error: "Payment not completed" },
      { status: 402 }
    );
  }

  if (booking.status === "pending") {
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
