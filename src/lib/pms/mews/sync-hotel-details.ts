// Pulls property metadata from Mews configuration/get into our DB, mirroring the
// Cloudbeds sync-hotel-details strategy:
//   1. content_blocks (address / phone / email / lat-lon): non-destructive — a
//      field is only filled when its current value still matches the Portico
//      default, so admin overrides survive.
//   2. properties (name / currency / timezone): overwrite from the enterprise.
// Mews's enterprise config exposes no check-in/out times, so (unlike Cloudbeds)
// the goodToKnow block is left untouched.

import { db } from "@/db";
import { contentBlocks, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { mews } from "./client";
import { getMewsCredentials } from "./credentials";
import {
  defaultContent,
  type ContentContact,
  type ContentNeighbourhood,
} from "@/lib/content-defaults";

interface MewsConfigResponse {
  Enterprise?: {
    Name?: string;
    Email?: string;
    Phone?: string;
    TimeZoneIdentifier?: string;
    Currencies?: Array<{ Currency?: string; IsDefault?: boolean }>;
    Address?: {
      Line1?: string;
      Line2?: string;
      City?: string;
      PostalCode?: string;
      CountryCode?: string;
      Latitude?: number | null;
      Longitude?: number | null;
    };
  };
}

type MewsAddress = NonNullable<MewsConfigResponse["Enterprise"]>["Address"];

function buildAddressLines(addr: MewsAddress | undefined): string[] | null {
  if (!addr) return null;
  const street = [addr.Line1, addr.Line2].filter(Boolean).join(" ").trim();
  const cityLine = [addr.City, addr.PostalCode].filter(Boolean).join(" ").trim();
  const lines = [street, cityLine, addr.CountryCode?.trim()].filter(
    (s): s is string => !!s && s.length > 0
  );
  return lines.length > 0 ? lines : null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function readBlock<T>(propertyId: string, key: string): Promise<T | null> {
  const [row] = await db
    .select({ content: contentBlocks.content })
    .from(contentBlocks)
    .where(and(eq(contentBlocks.propertyId, propertyId), eq(contentBlocks.key, key)))
    .limit(1);
  return (row?.content as T) ?? null;
}

async function writeBlock(
  propertyId: string,
  key: string,
  content: unknown
): Promise<void> {
  await db
    .insert(contentBlocks)
    .values({ propertyId, key, content })
    .onConflictDoUpdate({
      target: [contentBlocks.propertyId, contentBlocks.key],
      set: { content },
    });
}

export async function syncMewsHotelDetailsForProperty(
  propertyId: string
): Promise<void> {
  const { accessToken } = await getMewsCredentials(propertyId);

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) throw new Error(`Property ${propertyId} not found`);

  const config = await mews<MewsConfigResponse>("configuration/get", accessToken, {});
  const ent = config.Enterprise ?? {};

  // --- properties row: name / currency / timezone ---
  const name = ent.Name?.trim() || null;
  const currency =
    ent.Currencies?.find((c) => c.IsDefault)?.Currency?.trim() ||
    ent.Currencies?.[0]?.Currency?.trim() ||
    null;
  const timezone = ent.TimeZoneIdentifier?.trim() || null;

  const propertyUpdate: Partial<typeof properties.$inferInsert> = {};
  if (name && property.name !== name) propertyUpdate.name = name;
  if (currency && property.currency !== currency) propertyUpdate.currency = currency;
  if (timezone && property.timezone !== timezone) propertyUpdate.timezone = timezone;
  if (Object.keys(propertyUpdate).length > 0) {
    await db.update(properties).set(propertyUpdate).where(eq(properties.id, propertyId));
  }

  // --- contact block (address / phone / email) ---
  const addressLines = buildAddressLines(ent.Address);
  const phone = ent.Phone?.trim() || null;
  const email = ent.Email?.trim() || null;

  if (addressLines || phone || email) {
    const existing = await readBlock<ContentContact>(propertyId, "contact");
    const base: ContentContact = existing
      ? { ...defaultContent.contact, ...existing }
      : { ...defaultContent.contact };
    const next: ContentContact = { ...base };

    if (addressLines && arraysEqual(base.addressLines, defaultContent.contact.addressLines)) {
      next.addressLines = addressLines;
    }
    if (phone && base.reservationsPhone === defaultContent.contact.reservationsPhone) {
      next.reservationsPhone = phone;
    }
    if (email && base.reservationsEmail === defaultContent.contact.reservationsEmail) {
      next.reservationsEmail = email;
    }
    if (email && base.generalEmail === defaultContent.contact.generalEmail) {
      next.generalEmail = email;
    }
    if (JSON.stringify(next) !== JSON.stringify(base)) {
      await writeBlock(propertyId, "contact", next);
    }
  }

  // --- neighbourhood block (lat/lon only) ---
  const lat = ent.Address?.Latitude ?? null;
  const lon = ent.Address?.Longitude ?? null;
  if (typeof lat === "number" && typeof lon === "number") {
    const existing = await readBlock<ContentNeighbourhood>(propertyId, "neighbourhood");
    const base: ContentNeighbourhood = existing
      ? { ...defaultContent.neighbourhood, ...existing }
      : { ...defaultContent.neighbourhood };
    const next: ContentNeighbourhood = { ...base };

    if (base.mapLat === defaultContent.neighbourhood.mapLat) next.mapLat = lat;
    if (base.mapLon === defaultContent.neighbourhood.mapLon) next.mapLon = lon;

    if (next.mapLat !== base.mapLat || next.mapLon !== base.mapLon) {
      await writeBlock(propertyId, "neighbourhood", next);
    }
  }
}
