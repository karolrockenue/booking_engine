import { headers } from "next/headers";
import { db } from "@/db";
import { properties, pages, contentBlocks, images, roomTypes } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { type PropertyTheme, defaultTheme } from "./theme";

export type ResolvedProperty = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  currency: string | null;
  timezone: string | null;
  theme: PropertyTheme;
  status: string | null;
  myaPropertyId: string | null;
  otaPropertyId: string | null;
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

  // In dev, also check for x-property-slug (set by middleware from ?property= param)
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

  // Fallback: if no property matched by domain, use the first one
  // This covers localhost dev, Railway preview URLs, and single-property setups
  if (!property) {
    [property] = await db.select().from(properties).limit(1);
  }

  if (!property) return null;

  return {
    id: property.id,
    slug: property.slug,
    name: property.name,
    domain: property.domain,
    currency: property.currency,
    timezone: property.timezone,
    theme: parseTheme(property.theme),
    status: property.status,
    myaPropertyId: property.myaPropertyId,
    otaPropertyId: property.otaPropertyId,
  };
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
