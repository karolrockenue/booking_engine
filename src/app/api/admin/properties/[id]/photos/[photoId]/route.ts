import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { images } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { deleteFromR2 } from "@/lib/r2/client";

const VALID_SLOTS = new Set(["hero", "gallery", "room", "neighbourhood"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId, photoId } = await params;
  const body = (await req.json()) as {
    slot?: string;
    roomTypeId?: string | null;
    sortOrder?: number;
    altText?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.slot !== undefined) {
    if (!VALID_SLOTS.has(body.slot)) {
      return NextResponse.json(
        { error: `Invalid slot. Allowed: ${[...VALID_SLOTS].join(", ")}` },
        { status: 400 }
      );
    }
    updates.slot = body.slot;
  }
  if (body.roomTypeId !== undefined) updates.roomTypeId = body.roomTypeId;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.altText !== undefined) updates.altText = body.altText;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(images)
    .set(updates)
    .where(and(eq(images.id, photoId), eq(images.propertyId, propertyId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json({ photo: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId, photoId } = await params;

  const [photo] = await db
    .select()
    .from(images)
    .where(and(eq(images.id, photoId), eq(images.propertyId, propertyId)))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  // Collect every R2 key tied to this photo: variants + the canonical key.
  const keysToDelete = new Set<string>();
  keysToDelete.add(photo.key);
  if (photo.variants && typeof photo.variants === "object") {
    for (const v of Object.values(photo.variants as Record<string, { key?: string }>)) {
      if (v && typeof v.key === "string") keysToDelete.add(v.key);
    }
  }

  // Delete the DB row first; if R2 deletion fails the orphan is harmless.
  await db
    .delete(images)
    .where(and(eq(images.id, photoId), eq(images.propertyId, propertyId)));

  await Promise.all(
    Array.from(keysToDelete).map(async (k) => {
      try {
        await deleteFromR2(k);
      } catch (err) {
        console.error(`R2 delete failed for ${k}:`, err);
      }
    })
  );

  return NextResponse.json({ ok: true });
}
