import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import {
  properties,
  pages,
  contentBlocks,
  images,
  roomTypes,
  ratePlans,
  inventory,
  bookings,
} from "@/db/schema";
import { eq } from "drizzle-orm";

// GET — get a single property with all related data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [propertyPages, propertyContent, propertyImages, propertyRooms, propertyRates] =
    await Promise.all([
      db.select().from(pages).where(eq(pages.propertyId, id)),
      db.select().from(contentBlocks).where(eq(contentBlocks.propertyId, id)),
      db.select().from(images).where(eq(images.propertyId, id)),
      db.select().from(roomTypes).where(eq(roomTypes.propertyId, id)),
      db.select().from(ratePlans).where(eq(ratePlans.propertyId, id)),
    ]);

  return NextResponse.json({
    ...property,
    pages: propertyPages,
    contentBlocks: propertyContent,
    images: propertyImages,
    roomTypes: propertyRooms,
    ratePlans: propertyRates,
  });
}

// PATCH — update a property
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();

  // Only allow updating specific fields. Stripe and Cloudbeds-token fields
  // are set programmatically (OAuth callback / Connect onboarding webhook),
  // not via the admin PATCH.
  const allowed: Record<string, unknown> = {};
  const fields = [
    "name",
    "slug",
    "domain",
    "cloudbedsPropertyId",
    "platformFeePercent",
    "payoutSchedule",
    "currency",
    "timezone",
    "theme",
    "status",
  ] as const;

  for (const field of fields) {
    if (body[field] !== undefined) {
      allowed[field] = body[field];
    }
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(properties)
    .set(allowed)
    .where(eq(properties.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
