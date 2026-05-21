import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { roomTypes } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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

interface PatchBody {
  roomId?: string;
  hiddenFromBooking?: boolean;
}

// Toggle a room type's visibility in the booking engine. Admin-owned config
// the inventory sync never touches, so it survives re-syncs.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id: propertyId } = await params;
  const body = (await req.json()) as PatchBody;

  if (!body.roomId || typeof body.hiddenFromBooking !== "boolean") {
    return NextResponse.json(
      { error: "roomId and a boolean hiddenFromBooking are required" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(roomTypes)
    .set({ hiddenFromBooking: body.hiddenFromBooking })
    .where(
      and(eq(roomTypes.id, body.roomId), eq(roomTypes.propertyId, propertyId))
    )
    .returning({
      id: roomTypes.id,
      hiddenFromBooking: roomTypes.hiddenFromBooking,
    });

  if (!updated) {
    return NextResponse.json(
      { error: "Room type not found for this property" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}
