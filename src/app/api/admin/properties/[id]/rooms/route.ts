import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { roomTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  const rooms = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.propertyId, id));

  return NextResponse.json(rooms);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json();

  const [room] = await db
    .insert(roomTypes)
    .values({
      propertyId: id,
      otaRoomId: body.otaRoomId,
      name: body.name,
      description: body.description ?? null,
      maxOccupancy: body.maxOccupancy ?? null,
      baseOccupancy: body.baseOccupancy ?? null,
      amenities: body.amenities ?? null,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();

  return NextResponse.json(room, { status: 201 });
}
