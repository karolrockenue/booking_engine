import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");

  let query = db
    .select({
      id: bookings.id,
      orderId: bookings.orderId,
      propertyId: bookings.propertyId,
      propertyName: properties.name,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      guestFirst: bookings.guestFirst,
      guestLast: bookings.guestLast,
      guestEmail: bookings.guestEmail,
      totalPrice: bookings.totalPrice,
      currency: bookings.currency,
      myaStatus: bookings.myaStatus,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .orderBy(desc(bookings.createdAt));

  const results = propertyId
    ? await query.where(eq(bookings.propertyId, propertyId))
    : await query;

  return NextResponse.json(results);
}
