import { headers } from "next/headers";
import { db } from "@/db";
import { properties, pages, contentBlocks, images, roomTypes } from "@/db/schema";
import { asc, eq, or, isNotNull } from "drizzle-orm";
import { type PropertyTheme, defaultTheme } from "./theme";
import { mergeContent, type PropertyContent } from "./content-defaults";

export type { PropertyContent };

export type ResolvedProperty = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  currency: string | null;
  timezone: string | null;
  theme: PropertyTheme;
  status: string | null;
};

/**
 * Resolve the current property from the request.
 * Priority: ?property=slug query param (dev) → Host header → domain lookup
 */
export async function resolveProperty(): Promise<ResolvedProperty | null> {
  const headersList = await headers();
  const host =
    headersList.get("x-property-host") ?? headersList.get("host") ?? "";
  const domain = host.split(":")[0]; // strip port

  // In dev, also check for x-property-slug (set by proxy from ?property= param)
  const slugOverride = headersList.get("x-property-slug");

  let property;

  if (slugOverride) {
    [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.slug, slugOverride))
      .limit(1);
  }

  if (!property) {
    [property] = await db
      .select()
      .from(properties)
      .where(
        or(
          eq(properties.domain, host),
          eq(properties.domain, domain),
          eq(properties.slug, domain)
        )
      )
      .limit(1);
  }

  // Fallback: if no property matched by domain, prefer one that's actually
  // wired up to Cloudbeds. Localhost dev, Railway preview URLs, and
  // single-property setups land here — picking a Cloudbeds-connected
  // property means bookings work without needing a ?property= override.
  if (!property) {
    [property] = await db
      .select()
      .from(properties)
      .where(isNotNull(properties.cloudbedsPropertyId))
      .limit(1);
  }

  // Final fallback: any property at all (covers fresh DBs with nothing
  // connected yet).
  if (!property) {
    [property] = await db.select().from(properties).limit(1);
  }

  return property ? toResolved(property) : null;
}

type PropertyRow = typeof properties.$inferSelect;

function toResolved(property: PropertyRow): ResolvedProperty {
  return {
    id: property.id,
    slug: property.slug,
    name: property.name,
    domain: property.domain,
    currency: property.currency,
    timezone: property.timezone,
    theme: parseTheme(property.theme),
    status: property.status,
  };
}

/**
 * Resolve a property directly by its slug — used by the per-property customer
 * routes under app/[property]/. The slug comes from the URL path, so the
 * property is whatever the path says (no domain/header guessing). Returns null
 * for an unknown slug so the page can 404.
 */
export async function resolvePropertyBySlug(
  slug: string
): Promise<ResolvedProperty | null> {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  return property ? toResolved(property) : null;
}

export async function getPropertyWithContent(propertyId: string) {
  const [propertyPages, propertyContent, propertyImages, propertyRooms] =
    await Promise.all([
      db.select().from(pages).where(eq(pages.propertyId, propertyId)),
      db
        .select()
        .from(contentBlocks)
        .where(eq(contentBlocks.propertyId, propertyId)),
      db.select().from(images).where(eq(images.propertyId, propertyId)),
      db.select().from(roomTypes).where(eq(roomTypes.propertyId, propertyId)),
    ]);

  return {
    pages: propertyPages,
    contentBlocks: propertyContent,
    images: propertyImages,
    roomTypes: propertyRooms,
  };
}

// Photo for customer-facing rendering. The DB row stores 3 variant URLs;
// callers pick whichever fits their layout context (hero / gallery / thumb).
export interface PropertyPhoto {
  id: string;
  urls: { hero: string; gallery: string; thumb: string };
  width: number | null;
  height: number | null;
  altText: string | null;
  sortOrder: number;
}

export interface PropertyPhotos {
  heroSlot: PropertyPhoto[];
  gallerySlot: PropertyPhoto[];
  neighbourhoodSlot: PropertyPhoto[];
  byRoomType: Record<string, PropertyPhoto[]>;
}

interface VariantRecord {
  url?: string;
}

function variantUrls(variants: unknown, fallback: string): {
  hero: string;
  gallery: string;
  thumb: string;
} {
  if (!variants || typeof variants !== "object") {
    return { hero: fallback, gallery: fallback, thumb: fallback };
  }
  const v = variants as Record<string, VariantRecord>;
  return {
    hero: v.hero?.url ?? fallback,
    gallery: v.gallery?.url ?? fallback,
    thumb: v.thumb?.url ?? fallback,
  };
}

export async function getPropertyPhotos(
  propertyId: string
): Promise<PropertyPhotos> {
  const rows = await db
    .select()
    .from(images)
    .where(eq(images.propertyId, propertyId))
    .orderBy(asc(images.sortOrder));

  const out: PropertyPhotos = {
    heroSlot: [],
    gallerySlot: [],
    neighbourhoodSlot: [],
    byRoomType: {},
  };

  for (const row of rows) {
    const photo: PropertyPhoto = {
      id: row.id,
      urls: variantUrls(row.variants, row.url),
      width: row.width,
      height: row.height,
      altText: row.altText,
      sortOrder: row.sortOrder ?? 0,
    };
    if (row.slot === "hero") out.heroSlot.push(photo);
    else if (row.slot === "gallery") out.gallerySlot.push(photo);
    else if (row.slot === "neighbourhood") out.neighbourhoodSlot.push(photo);
    else if (row.slot === "room" && row.roomTypeId) {
      const arr = out.byRoomType[row.roomTypeId] ?? [];
      arr.push(photo);
      out.byRoomType[row.roomTypeId] = arr;
    }
  }

  return out;
}

export async function getPropertyContent(
  propertyId: string
): Promise<PropertyContent> {
  const blocks = await db
    .select({ key: contentBlocks.key, content: contentBlocks.content })
    .from(contentBlocks)
    .where(eq(contentBlocks.propertyId, propertyId));
  return mergeContent(blocks);
}

export function parseTheme(raw: unknown): PropertyTheme {
  if (!raw || typeof raw !== "object") return defaultTheme;
  const t = raw as Record<string, unknown>;
  return {
    ...defaultTheme,
    ...t,
    colors: { ...defaultTheme.colors, ...((t.colors as object) ?? {}) },
    typography: { ...defaultTheme.typography, ...((t.typography as object) ?? {}) },
    layout: { ...defaultTheme.layout, ...((t.layout as object) ?? {}) },
    style: { ...defaultTheme.style, ...((t.style as object) ?? {}) },
    contact: { ...defaultTheme.contact, ...((t.contact as object) ?? {}) },
    social: { ...defaultTheme.social, ...((t.social as object) ?? {}) },
    hero: { ...defaultTheme.hero, ...((t.hero as object) ?? {}) },
    nav: { ...defaultTheme.nav, ...((t.nav as object) ?? {}) },
  } as PropertyTheme;
}
