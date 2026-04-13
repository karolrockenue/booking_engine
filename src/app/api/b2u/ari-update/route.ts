import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";
import { db } from "@/db";
import { properties, roomTypes, ratePlans, inventory } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

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

  const rooms = body.Rooms as Array<{
    RoomId: string;
    RateId?: string;
    StartDate: string;
    EndDate: string;
    Units?: string;
    Price?: string;
    MinStay?: string;
    MaxStay?: string;
    ClosedToArrival?: boolean;
    ClosedToDeparture?: boolean;
  }>;

  if (!rooms || rooms.length === 0) {
    return NextResponse.json({ success: true });
  }

  for (const room of rooms) {
    // Look up the room type
    const [roomType] = await db
      .select()
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, property.id),
          eq(roomTypes.otaRoomId, room.RoomId)
        )
      )
      .limit(1);

    if (!roomType) continue;

    // Look up rate plan if provided
    let ratePlanId: string | null = null;
    if (room.RateId) {
      const [plan] = await db
        .select()
        .from(ratePlans)
        .where(
          and(
            eq(ratePlans.propertyId, property.id),
            eq(ratePlans.otaRateId, room.RateId)
          )
        )
        .limit(1);
      if (plan) ratePlanId = plan.id;
    }

    // Expand date range into individual days and upsert
    const start = new Date(room.StartDate);
    const end = new Date(room.EndDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];

      await db
        .insert(inventory)
        .values({
          propertyId: property.id,
          roomTypeId: roomType.id,
          ratePlanId: ratePlanId,
          date: dateStr,
          unitsAvailable: room.Units ? parseInt(room.Units) : 0,
          rate: room.Price ?? null,
          minStay: room.MinStay ? parseInt(room.MinStay) : 1,
          maxStay: room.MaxStay ? parseInt(room.MaxStay) : null,
          closedArrival: room.ClosedToArrival ?? false,
          closedDeparture: room.ClosedToDeparture ?? false,
          updatedAt: sql`NOW()`,
        })
        .onConflictDoUpdate({
          target: [
            inventory.propertyId,
            inventory.roomTypeId,
            inventory.ratePlanId,
            inventory.date,
          ],
          set: {
            unitsAvailable: room.Units ? parseInt(room.Units) : 0,
            rate: room.Price ?? null,
            minStay: room.MinStay ? parseInt(room.MinStay) : 1,
            maxStay: room.MaxStay ? parseInt(room.MaxStay) : null,
            closedArrival: room.ClosedToArrival ?? false,
            closedDeparture: room.ClosedToDeparture ?? false,
            updatedAt: sql`NOW()`,
          },
        });
    }
  }

  return NextResponse.json({ success: true });
}
