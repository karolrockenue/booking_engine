import { NextRequest, NextResponse } from "next/server";
import { verifyB2URequest } from "@/lib/b2u-auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authError = verifyB2URequest(req, body);
  if (authError) return authError;

  const myaPropertyId = body.mya_property_id as string;
  if (!myaPropertyId) {
    return NextResponse.json(
      { success: false, error: "Missing mya_property_id" },
      { status: 400 }
    );
  }

  // Find the property linked to this myallocator ID
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.myaPropertyId, myaPropertyId))
    .limit(1);

  if (!property) {
    return NextResponse.json(
      { success: false, error: "Property not found for this mya_property_id" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    ota_property_id: property.otaPropertyId ?? property.id,
  });
}
