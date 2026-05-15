import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { images, roomTypes } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { uploadToR2 } from "@/lib/r2/client";
import { resizeToWebVariants, VARIANT_NAMES, type VariantKey } from "@/lib/r2/resize";
import { randomUUID } from "node:crypto";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
]);
// Bumped to 30MB now that we resize on upload — originals from a DSLR are
// typically 10-25MB. Variants are sub-MB regardless.
const MAX_BYTES = 30 * 1024 * 1024;

// `marketing` is admin-only — never surfaced on the public site (see
// getPropertyPhotos in lib/get-property.ts which silently ignores it). Use it
// for logos, brand assets, anything embedded in emails but not the website.
const VALID_SLOTS = new Set(["hero", "gallery", "room", "neighbourhood", "marketing"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  const [photos, rooms] = await Promise.all([
    db
      .select()
      .from(images)
      .where(eq(images.propertyId, id))
      .orderBy(asc(images.slot), asc(images.sortOrder)),
    db
      .select({ id: roomTypes.id, name: roomTypes.name })
      .from(roomTypes)
      .where(eq(roomTypes.propertyId, id))
      .orderBy(asc(roomTypes.name)),
  ]);

  return NextResponse.json({ photos, rooms });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type ${file.type}. Allowed: ${[...ALLOWED_MIME].join(", ")}` },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${formatMB(file.size)}). Max ${formatMB(MAX_BYTES)}.` },
      { status: 413 }
    );
  }

  const slotRaw = (formData.get("slot") as string | null) ?? "gallery";
  const slot = VALID_SLOTS.has(slotRaw) ? slotRaw : "gallery";
  const roomTypeIdRaw = formData.get("roomTypeId") as string | null;
  const roomTypeId = roomTypeIdRaw && roomTypeIdRaw.length > 0 ? roomTypeIdRaw : null;
  const altText = (formData.get("altText") as string | null) ?? null;

  const arrayBuffer = await file.arrayBuffer();
  const sourceBuffer = Buffer.from(arrayBuffer);

  let variants;
  try {
    variants = await resizeToWebVariants(sourceBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "image processing failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Upload all 3 variants in parallel under a shared UUID prefix.
  const baseId = randomUUID();
  const baseKey = `properties/${propertyId}/${baseId}`;

  const variantRecords: Record<
    VariantKey,
    { key: string; url: string; width: number; height: number; sizeBytes: number }
  > = {} as never;

  try {
    await Promise.all(
      VARIANT_NAMES.map(async (name) => {
        const v = variants[name];
        const key = `${baseKey}-${name}.${v.ext}`;
        const { url } = await uploadToR2({
          key,
          body: v.buffer,
          contentType: v.contentType,
        });
        variantRecords[name] = {
          key,
          url,
          width: v.width,
          height: v.height,
          sizeBytes: v.sizeBytes,
        };
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Determine sortOrder by appending after existing photos in the same slot.
  const existingMax = await db
    .select({ max: images.sortOrder })
    .from(images)
    .where(
      and(
        eq(images.propertyId, propertyId),
        eq(images.slot, slot),
        roomTypeId ? eq(images.roomTypeId, roomTypeId) : eq(images.slot, slot)
      )
    )
    .orderBy(asc(images.sortOrder));
  const nextSort = existingMax.length
    ? Math.max(...existingMax.map((r) => r.max ?? 0)) + 1
    : 0;

  // The DB row's `key`/`url`/`width`/`height` point to the gallery variant —
  // a sane default for any consumer that doesn't know about variants.
  // Variants object has all 3 for consumers that do.
  const gallery = variantRecords.gallery;

  const [row] = await db
    .insert(images)
    .values({
      propertyId,
      key: gallery.key,
      url: gallery.url,
      altText,
      width: gallery.width,
      height: gallery.height,
      slot,
      roomTypeId,
      sortOrder: nextSort,
      mimeType: "image/jpeg",
      sizeBytes:
        variantRecords.hero.sizeBytes +
        variantRecords.gallery.sizeBytes +
        variantRecords.thumb.sizeBytes,
      variants: variantRecords,
    })
    .returning();

  return NextResponse.json({ photo: row }, { status: 201 });
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}
