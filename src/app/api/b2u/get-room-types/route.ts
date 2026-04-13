import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";
import { db } from "@/db";
import { properties, roomTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  const rooms = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.propertyId, property.id));

  return NextResponse.json({
    success: true,
    RoomTypes: rooms.map((r) => ({
      RoomId: r.otaRoomId,
      RoomName: r.name,
      MaxOccupancy: r.maxOccupancy,
    })),
  });
}
