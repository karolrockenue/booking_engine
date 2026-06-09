import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties, ratePlans, roomTypes } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  // pmsType drives PMS-aware copy in the admin Rates UI ("synced from Mews"
  // vs "Cloudbeds", source-link target, etc.).
  const [property] = await db
    .select({ pmsType: properties.pmsType })
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  const list = await db
    .select({
      id: ratePlans.id,
      otaRateId: ratePlans.otaRateId,
      name: ratePlans.name,
      namePublic: ratePlans.namePublic,
      displayName: ratePlans.displayName,
      isPublic: ratePlans.isPublic,
      isRefundable: ratePlans.isRefundable,
      cancellationPolicy: ratePlans.cancellationPolicy,
      roomTypeId: ratePlans.roomTypeId,
      roomTypeName: roomTypes.name,
      roomTypeOtaId: roomTypes.otaRoomId,
    })
    .from(ratePlans)
    .leftJoin(roomTypes, eq(ratePlans.roomTypeId, roomTypes.id))
    .where(eq(ratePlans.propertyId, id))
    .orderBy(asc(roomTypes.name), asc(ratePlans.name));

  return NextResponse.json({
    ratePlans: list,
    pmsType: property?.pmsType ?? "cloudbeds",
  });
}
