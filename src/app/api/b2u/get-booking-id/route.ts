import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";
import { db } from "@/db";
import { bookings, bookingDayRates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authError = verifyB2URequest(req, body);
  if (authError) return authError;

  const orderId = body.booking_id as string;
  if (!orderId) {
    return NextResponse.json(
      { success: false, error: "Missing booking_id" },
      { status: 400 }
    );
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, orderId))
    .limit(1);

  if (!booking) {
    return NextResponse.json(
      { success: false, error: "Booking not found" },
      { status: 404 }
    );
  }

  const dayRates = await db
    .select()
    .from(bookingDayRates)
    .where(eq(bookingDayRates.bookingId, booking.id));

  return NextResponse.json({
    success: true,
    Booking: {
      OrderId: booking.orderId,
      OrderDate: booking.createdAt?.toISOString().split("T")[0],
      IsCancellation: booking.myaStatus === "cancelled" ? 1 : 0,
      TotalCurrency: booking.currency,
      TotalPrice: parseFloat(booking.totalPrice),
      Customers: [
        {
          CustomerFName: booking.guestFirst,
          CustomerLName: booking.guestLast,
          CustomerEmail: booking.guestEmail,
          CustomerCountry: booking.guestCountry,
        },
      ],
      Rooms: [
        {
          StartDate: booking.checkIn,
          EndDate: booking.checkOut,
          Price: parseFloat(booking.totalPrice),
          Units: 1,
          Currency: booking.currency,
          DayRates: dayRates.map((dr) => ({
            Date: dr.date,
            Rate: parseFloat(dr.rate),
            Currency: booking.currency,
            RateId: dr.rateId,
          })),
        },
      ],
    },
  });
}
