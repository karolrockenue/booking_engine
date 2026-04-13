import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";
import { db } from "@/db";
import { properties, ratePlans, roomTypes } from "@/db/schema";
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

  const plans = await db
    .select({
      otaRateId: ratePlans.otaRateId,
      name: ratePlans.name,
      roomOtaId: roomTypes.otaRoomId,
    })
    .from(ratePlans)
    .innerJoin(roomTypes, eq(ratePlans.roomTypeId, roomTypes.id))
    .where(eq(ratePlans.propertyId, property.id));

  return NextResponse.json({
    success: true,
    RatePlans: plans.map((p) => ({
      RateId: p.otaRateId,
      RateName: p.name,
      RoomId: p.roomOtaId,
    })),
  });
}
