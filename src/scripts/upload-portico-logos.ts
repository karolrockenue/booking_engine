/**
 * One-off seeder: upload the Portico logo PNGs from public/portico/ into the
 * "marketing" media slot for the property with slug `demo`. After running,
 * the logos appear in Admin → Media → Marketing and in the email composer's
 * "Insert logo" library.
 *
 * Run with:
 *   set -a && source .env.local && set +a && npx tsx src/scripts/upload-portico-logos.ts [slug=demo]
 */

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import sharp from "sharp";
import { db } from "../db";
import { properties, images } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { uploadToR2, deleteFromR2 } from "../lib/r2/client";

// Logos are PNGs with transparency. The regular photo pipeline converts to
// JPEG with mozjpeg, which fills transparent pixels with black — fine for
// photos, fatal for logos. So we build PNG variants directly here.
const LOGO_WIDTHS = { hero: 1200, gallery: 600, thumb: 240 } as const;
type LogoVariantKey = keyof typeof LOGO_WIDTHS;

async function buildLogoVariants(input: Buffer): Promise<
  Record<LogoVariantKey, { buffer: Buffer; width: number; height: number; sizeBytes: number }>
> {
  const out = {} as Record<
    LogoVariantKey,
    { buffer: Buffer; width: number; height: number; sizeBytes: number }
  >;
  for (const [name, width] of Object.entries(LOGO_WIDTHS) as Array<[LogoVariantKey, number]>) {
    const result = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    out[name] = {
      buffer: result.data,
      width: result.info.width,
      height: result.info.height,
      sizeBytes: result.data.length,
    };
  }
  return out;
}

interface Asset {
  filename: string;
  altText: string;
}

const ASSETS: Asset[] = [
  { filename: "portico-logo.png", altText: "The Portico Hotel · dark logo" },
  { filename: "portico-logo-white.png", altText: "The Portico Hotel · white logo" },
];

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!property) {
    console.error(`No property with slug "${slug}".`);
    process.exit(1);
  }

  for (const asset of ASSETS) {
    const localPath = path.join(process.cwd(), "public", "portico", asset.filename);
    let buffer: Buffer;
    try {
      buffer = await readFile(localPath);
    } catch (err) {
      console.error(`Skipping ${asset.filename} — ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // Re-runnable: delete any existing row + its R2 variants so we replace
    // the JPEG mistakes with PNG.
    const existing = await db
      .select()
      .from(images)
      .where(
        and(eq(images.propertyId, property.id), eq(images.altText, asset.altText))
      );
    for (const row of existing) {
      const variants = (row.variants ?? {}) as Record<string, { key?: string }>;
      const keys = new Set<string>([row.key]);
      for (const v of Object.values(variants)) {
        if (v?.key) keys.add(v.key);
      }
      for (const k of keys) {
        try {
          await deleteFromR2(k);
        } catch {
          // ignore — file may already be gone
        }
      }
      await db.delete(images).where(eq(images.id, row.id));
      console.log(`Removed existing · ${asset.altText}`);
    }

    const baseId = randomUUID();
    const variants = await buildLogoVariants(buffer);
    const variantUrls: Record<string, { key: string; url: string; width: number; height: number; sizeBytes: number }> = {};
    for (const name of Object.keys(LOGO_WIDTHS) as LogoVariantKey[]) {
      const v = variants[name];
      const key = `properties/${property.id}/${baseId}-${name}.png`;
      const { url } = await uploadToR2({ key, body: v.buffer, contentType: "image/png" });
      variantUrls[name] = {
        key,
        url,
        width: v.width,
        height: v.height,
        sizeBytes: v.buffer.length,
      };
    }

    const primaryUrl = variantUrls.gallery?.url ?? variantUrls.hero?.url ?? variantUrls.thumb?.url;
    if (!primaryUrl) {
      console.error(`No variant URL produced for ${asset.filename}`);
      continue;
    }

    await db.insert(images).values({
      propertyId: property.id,
      key: `properties/${property.id}/${baseId}.png`,
      url: primaryUrl,
      altText: asset.altText,
      slot: "marketing",
      mimeType: "image/png",
      sizeBytes: buffer.length,
      width: variantUrls.gallery?.width ?? null,
      height: variantUrls.gallery?.height ?? null,
      variants: variantUrls,
    });
    console.log(`Uploaded · ${asset.altText} (PNG, transparency preserved)`);
  }

  console.log("\nDone. Open Admin → Media → Marketing to see them.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
