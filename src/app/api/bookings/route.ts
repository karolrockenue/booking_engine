import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, bookingDayRates, inventory, ratePlans } from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";

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

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  // Re-verify availability before confirming
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

  // Look up the rate plan to derive rateType (flex/nr) for the booking record.
  // Cloudbeds postReservation + Stripe charge wiring lands in plan Steps 10/11.
  const [ratePlan] = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.id, ratePlanId))
    .limit(1);

  const rateType = ratePlan?.isRefundable === false ? "nr" : "flex";

  const orderId = generateOrderId();
  const roomTotal = totalPrice.toFixed(2);

  const [booking] = await db
    .insert(bookings)
    .values({
      propertyId,
      orderId,
      roomTypeId,
      ratePlanId,
      rateType,
      checkIn,
      checkOut,
      adults: adults ?? 1,
      children: children ?? 0,
      guestFirst,
      guestLast,
      guestEmail,
      guestPhone: guestPhone ?? null,
      guestCountry: guestCountry ?? null,
      roomTotal,
      extrasTotal: "0.00",
      taxesTotal: "0.00",
      grandTotal: roomTotal,
      currency: currency ?? "GBP",
      status: "pending",
    })
    .returning();

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

  return NextResponse.json({
    success: true,
    orderId,
    bookingId: booking.id,
  });
}
