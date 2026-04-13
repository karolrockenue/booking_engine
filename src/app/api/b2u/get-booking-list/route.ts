import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";
import { db } from "@/db";
import { properties, bookings, bookingDayRates } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

function formatBooking(
  b: typeof bookings.$inferSelect,
  dayRates: Array<typeof bookingDayRates.$inferSelect>
) {
  return {
    OrderId: b.orderId,
    OrderDate: b.createdAt?.toISOString().split("T")[0],
    IsCancellation: b.myaStatus === "cancelled" ? 1 : 0,
    TotalCurrency: b.currency,
    TotalPrice: parseFloat(b.totalPrice),
    Customers: [
      {
        CustomerFName: b.guestFirst,
        CustomerLName: b.guestLast,
        CustomerEmail: b.guestEmail,
        CustomerCountry: b.guestCountry,
      },
    ],
    Rooms: [
      {
        StartDate: b.checkIn,
        EndDate: b.checkOut,
        Price: parseFloat(b.totalPrice),
        Units: 1,
        Currency: b.currency,
        DayRates: dayRates.map((dr) => ({
          Date: dr.date,
          Rate: parseFloat(dr.rate),
          Currency: b.currency,
          RateId: dr.rateId,
        })),
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authError = verifyB2URequest(req, body);
  if (authError) return authError;

  const myaPropertyId = body.mya_property_id as string;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.myaPropertyId, myaPropertyId))
    .limit(1);

  if (!property) {
    return NextResponse.json(
      { success: false, error: "Property not found" },
      { status: 404 }
    );
  }

  let query = db
    .select()
    .from(bookings)
    .where(eq(bookings.propertyId, property.id));

  const allBookings = await query;

  const result = [];
  for (const b of allBookings) {
    const dayRates = await db
      .select()
      .from(bookingDayRates)
      .where(eq(bookingDayRates.bookingId, b.id));
    result.push(formatBooking(b, dayRates));
  }

  return NextResponse.json({ success: true, Bookings: result });
}
