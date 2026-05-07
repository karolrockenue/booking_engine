import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import {
  bookings,
  bookingExtras,
  roomTypes,
  ratePlans,
} from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  const list = await db
    .select({
      id: bookings.id,
      orderId: bookings.orderId,
      cloudbedsReservationId: bookings.cloudbedsReservationId,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      adults: bookings.adults,
      children: bookings.children,
      guestFirst: bookings.guestFirst,
      guestLast: bookings.guestLast,
      guestEmail: bookings.guestEmail,
      guestPhone: bookings.guestPhone,
      guestCountry: bookings.guestCountry,
      roomTotal: bookings.roomTotal,
      extrasTotal: bookings.extrasTotal,
      taxesTotal: bookings.taxesTotal,
      applicationFee: bookings.applicationFee,
      grandTotal: bookings.grandTotal,
      currency: bookings.currency,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeSetupIntentId: bookings.stripeSetupIntentId,
      stripeCustomerId: bookings.stripeCustomerId,
      cancellationPolicySnapshot: bookings.cancellationPolicySnapshot,
      rateType: bookings.rateType,
      status: bookings.status,
      createdAt: bookings.createdAt,
      roomTypeName: roomTypes.name,
      ratePlanName: ratePlans.name,
      ratePlanIsRefundable: ratePlans.isRefundable,
    })
    .from(bookings)
    .leftJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
    .leftJoin(ratePlans, eq(bookings.ratePlanId, ratePlans.id))
    .where(eq(bookings.propertyId, id))
    .orderBy(desc(bookings.createdAt))
    .limit(200);

  // Pull extras for the bookings on the page in one query, then hydrate.
  const ids = list.map((b) => b.id);
  const extras = ids.length
    ? await db
        .select()
        .from(bookingExtras)
        .where(inArray(bookingExtras.bookingId, ids))
    : [];
  const extrasByBooking = new Map<string, typeof extras>();
  for (const e of extras) {
    if (!e.bookingId) continue;
    const arr = extrasByBooking.get(e.bookingId) ?? [];
    arr.push(e);
    extrasByBooking.set(e.bookingId, arr);
  }

  const hydrated = list.map((b) => ({
    ...b,
    extras: extrasByBooking.get(b.id) ?? [],
  }));

  return NextResponse.json({ bookings: hydrated });
}
