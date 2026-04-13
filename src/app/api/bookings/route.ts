import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, bookingDayRates, inventory } from "@/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";

function generateOrderId() {
  const now = new Date();
  const date = now.toISOString().split("T")[0].replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `BK-${date}-${rand}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    propertyId,
    roomTypeId,
    ratePlanId,
    checkIn,
    checkOut,
    adults,
    children,
    guestFirst,
    guestLast,
    guestEmail,
    guestPhone,
    guestCountry,
    nightlyRates,
    totalPrice,
    currency,
  } = body as {
    propertyId: string;
    roomTypeId: string;
    ratePlanId: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    guestFirst: string;
    guestLast: string;
    guestEmail: string;
    guestPhone?: string;
    guestCountry?: string;
    nightlyRates: Array<{ date: string; rate: number; rateId?: string }>;
    totalPrice: number;
    currency: string;
  };

  // Validate required fields
  if (
    !propertyId ||
    !roomTypeId ||
    !ratePlanId ||
    !checkIn ||
    !checkOut ||
    !guestFirst ||
    !guestLast ||
    !guestEmail ||
    !totalPrice
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Re-verify availability before confirming
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  const inv = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.propertyId, propertyId),
        eq(inventory.roomTypeId, roomTypeId),
        eq(inventory.ratePlanId, ratePlanId),
        gte(inventory.date, checkIn),
        lt(inventory.date, checkOut)
      )
    );

  if (inv.length < nights) {
    return NextResponse.json(
      { error: "Room is no longer available for these dates" },
      { status: 409 }
    );
  }

  for (const day of inv) {
    if (day.unitsAvailable < 1) {
      return NextResponse.json(
        { error: "Room is no longer available for these dates" },
        { status: 409 }
      );
    }
  }

  const orderId = generateOrderId();

  // Create booking
  const [booking] = await db
    .insert(bookings)
    .values({
      propertyId,
      orderId,
      roomTypeId,
      ratePlanId,
      checkIn,
      checkOut,
      adults: adults ?? 1,
      children: children ?? 0,
      guestFirst,
      guestLast,
      guestEmail,
      guestPhone: guestPhone ?? null,
      guestCountry: guestCountry ?? null,
      totalPrice: totalPrice.toFixed(2),
      currency: currency ?? "GBP",
      myaStatus: "pending",
    })
    .returning();

  // Insert day rates
  if (nightlyRates && nightlyRates.length > 0) {
    await db.insert(bookingDayRates).values(
      nightlyRates.map((nr) => ({
        bookingId: booking.id,
        date: nr.date,
        rate: nr.rate.toFixed(2),
        rateId: nr.rateId ?? null,
      }))
    );
  }

  // TODO: Call Cloudbeds BookingCreate here when payment is wired up
  // For now, mark as confirmed (will change to: pending -> pay -> cloudbeds -> confirmed)
  await db
    .update(bookings)
    .set({ myaStatus: "confirmed" })
    .where(eq(bookings.id, booking.id));

  return NextResponse.json({
    success: true,
    orderId,
    bookingId: booking.id,
  });
}
