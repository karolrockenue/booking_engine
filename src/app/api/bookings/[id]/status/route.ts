import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";

// Fulfilment status for a booking — the poll target for the async-checkout flow
// (create-before-pay → 202 → poll here until the reservation number lands).
// Returns a coarse state the storefront can branch on without leaking internals.
//   pending    — booking row exists, no PMS reservation yet (still fulfilling)
//   confirmed  — reservation created in the PMS (reservationNumber present)
//   failed     — fulfilment gave up (refunded/detached by the retry cron)
//   cancelled  — guest/auto cancelled
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [booking] = await db
    .select({
      id: bookings.id,
      orderId: bookings.orderId,
      status: bookings.status,
      reservationId: bookings.cloudbedsReservationId,
      rateType: bookings.rateType,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const state =
    booking.status === "cancelled"
      ? "cancelled"
      : booking.status === "failed"
        ? "failed"
        : booking.reservationId
          ? "confirmed"
          : "pending";

  return NextResponse.json({
    bookingId: booking.id,
    orderId: booking.orderId,
    state,
    status: booking.status,
    rateType: booking.rateType,
    reservationNumber: booking.reservationId ?? null,
  });
}
