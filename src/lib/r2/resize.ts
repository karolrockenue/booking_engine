// Sharp-based image resizer. Takes the uploaded buffer and returns 3 web-sized
// JPEG variants. Originals are NOT kept in R2 — the admin's local copy is the
// archival master, so we don't pay storage to duplicate them.
//
// Always rotates per EXIF and never enlarges past the source dimensions.

import sharp from "sharp";

const VARIANT_WIDTHS = {
  hero: 1600,
  gallery: 800,
  thumb: 400,
} as const;

export type VariantKey = keyof typeof VARIANT_WIDTHS;

export interface ResizedVariant {
  buffer: Buffer;
  width: number;
  height: number;
  contentType: "image/jpeg";
  ext: "jpg";
  sizeBytes: number;
}

export async function resizeToWebVariants(
  input: Buffer
): Promise<Record<VariantKey, ResizedVariant>> {
  const result = {} as Record<VariantKey, ResizedVariant>;

  for (const [name, width] of Object.entries(VARIANT_WIDTHS) as Array<
    [VariantKey, number]
  >) {
    const out = await sharp(input)
      .rotate() // honour EXIF orientation, then strip metadata
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    result[name] = {
      buffer: out.data,
      width: out.info.width,
      height: out.info.height,
      contentType: "image/jpeg",
      ext: "jpg",
      sizeBytes: out.data.length,
    };
  }

  return result;
}

export const VARIANT_NAMES = Object.keys(VARIANT_WIDTHS) as VariantKey[];
