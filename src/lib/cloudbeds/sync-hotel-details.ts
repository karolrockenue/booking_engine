// Pulls property metadata (address, phone, email, check-in/out times, lat/lon,
// name, currency, timezone) from Cloudbeds /getHotelDetails and merges it into
// our DB.
//
// Two write strategies:
//   1. content_blocks (address/phone/email/lat/lon/check-in-out): non-destructive
//      — a field is only filled when its current value matches the Portico
//      default. Any admin override stays.
//   2. properties (name/currency/timezone): always overwrite. CB is the source
//      of truth. Note: the CB partner sandbox returns USD for non-USD
//      properties — that's expected during testing, will be correct on real
//      connections.

import { db } from "@/db";
import { contentBlocks, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cloudbeds } from "./client";
import {
  defaultContent,
  type ContentContact,
  type ContentNeighbourhood,
  type ContentGoodToKnow,
} from "@/lib/content-defaults";

interface CloudbedsHotelDetails {
  propertyID?: string;
  propertyName?: string;
  propertyCurrency?: { currencyCode?: string };
  propertyTimezone?: string;
  propertyAddress?: {
    propertyAddress1?: string;
    propertyAddress2?: string;
    propertyCity?: string;
    propertyState?: string;
    propertyZip?: string;
    propertyCountry?: string;
    propertyLatitude?: number | string;
    propertyLongitude?: number | string;
  };
  propertyPhone?: string;
  propertyEmail?: string;
  propertyPolicy?: {
    propertyCheckInTime?: string;
    propertyCheckOutTime?: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface HotelDetailsSyncResult {
  propertyId: string;
  contactUpdated: boolean;
  neighbourhoodUpdated: boolean;
  goodToKnowUpdated: boolean;
  propertyFieldsUpdated: string[];
}

function buildAddressLines(
  addr: CloudbedsHotelDetails["propertyAddress"]
): string[] | null {
  if (!addr) return null;
  const street = [addr.propertyAddress1, addr.propertyAddress2]
    .filter(Boolean)
    .join(" ")
    .trim();
  const cityLine = [addr.propertyCity, addr.propertyState, addr.propertyZip]
    .filter(Boolean)
    .join(" ")
    .trim();
  const lines = [street, cityLine, addr.propertyCountry?.trim()].filter(
    (s): s is string => !!s && s.length > 0
  );
  return lines.length > 0 ? lines : null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function readBlock<T>(
  propertyId: string,
  key: string
): Promise<T | null> {
  const [row] = await db
    .select({ content: contentBlocks.content })
    .from(contentBlocks)
    .where(
      and(
        eq(contentBlocks.propertyId, propertyId),
        eq(contentBlocks.key, key)
      )
    )
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

export async function syncHotelDetailsForProperty(
  propertyId: string
): Promise<HotelDetailsSyncResult> {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) throw new Error(`Property ${propertyId} not found`);

  let cloudbedsPropertyId = property.cloudbedsPropertyId;
  if (!cloudbedsPropertyId) {
    const hotels = await cloudbeds<
      ApiResponse<Array<{ propertyID: string }>>
    >(propertyId, "/getHotels");
    if (!hotels.success || !hotels.data?.length) {
      throw new Error(
        `Property ${propertyId} could not resolve a Cloudbeds property ID`
      );
    }
    cloudbedsPropertyId = hotels.data[0].propertyID;
  }

  const detailsRes = await cloudbeds<ApiResponse<CloudbedsHotelDetails>>(
    propertyId,
    "/getHotelDetails",
    { query: { propertyID: cloudbedsPropertyId } }
  );
  if (!detailsRes.success) {
    throw new Error(
      `getHotelDetails failed: ${detailsRes.message ?? "unknown"}`
    );
  }
  const cb = detailsRes.data;

  let contactUpdated = false;
  let neighbourhoodUpdated = false;
  let goodToKnowUpdated = false;
  const propertyFieldsUpdated: string[] = [];

  // --- properties row: name / currency / timezone ---
  // Always overwrite — Cloudbeds is source of truth for these. Sandbox can
  // return USD for non-USD properties; that's accepted during testing.
  const cbName = cb.propertyName?.trim() || null;
  const cbCurrency = cb.propertyCurrency?.currencyCode?.trim() || null;
  const cbTimezone = cb.propertyTimezone?.trim() || null;

  const propertyUpdate: Partial<typeof properties.$inferInsert> = {};
  if (cbName && property.name !== cbName) {
    propertyUpdate.name = cbName;
    propertyFieldsUpdated.push("name");
  }
  // Once a hotel is live on Ryft, its settlement currency is fixed by the Ryft
  // account — don't let Cloudbeds flip it (the sandbox returns USD for non-USD
  // hotels, which would break payment sessions against a GBP Ryft account).
  if (
    cbCurrency &&
    property.currency !== cbCurrency &&
    property.ryftAccountStatus !== "active"
  ) {
    propertyUpdate.currency = cbCurrency;
    propertyFieldsUpdated.push("currency");
  }
  if (cbTimezone && property.timezone !== cbTimezone) {
    propertyUpdate.timezone = cbTimezone;
    propertyFieldsUpdated.push("timezone");
  }
  if (Object.keys(propertyUpdate).length > 0) {
    await db
      .update(properties)
      .set(propertyUpdate)
      .where(eq(properties.id, propertyId));
  }

  // --- contact block ---
  const cbAddress = buildAddressLines(cb.propertyAddress);
  const cbPhone = cb.propertyPhone?.trim() || null;
  const cbEmail = cb.propertyEmail?.trim() || null;

  if (cbAddress || cbPhone || cbEmail) {
    const existing =
      (await readBlock<ContentContact>(propertyId, "contact")) ?? null;
    const base: ContentContact = existing
      ? { ...defaultContent.contact, ...existing }
      : { ...defaultContent.contact };
    const next: ContentContact = { ...base };

    if (
      cbAddress &&
      arraysEqual(base.addressLines, defaultContent.contact.addressLines)
    ) {
      next.addressLines = cbAddress;
    }
    if (
      cbPhone &&
      base.reservationsPhone === defaultContent.contact.reservationsPhone
    ) {
      next.reservationsPhone = cbPhone;
    }
    if (
      cbEmail &&
      base.reservationsEmail === defaultContent.contact.reservationsEmail
    ) {
      next.reservationsEmail = cbEmail;
    }
    if (
      cbEmail &&
      base.generalEmail === defaultContent.contact.generalEmail
    ) {
      next.generalEmail = cbEmail;
    }

    if (JSON.stringify(next) !== JSON.stringify(base)) {
      await writeBlock(propertyId, "contact", next);
      contactUpdated = true;
    }
  }

  // --- neighbourhood block (lat/lon only) ---
  const cbLat = toNumber(cb.propertyAddress?.propertyLatitude);
  const cbLon = toNumber(cb.propertyAddress?.propertyLongitude);
  if (cbLat !== null && cbLon !== null) {
    const existing =
      (await readBlock<ContentNeighbourhood>(propertyId, "neighbourhood")) ??
      null;
    const base: ContentNeighbourhood = existing
      ? { ...defaultContent.neighbourhood, ...existing }
      : { ...defaultContent.neighbourhood };
    const next: ContentNeighbourhood = { ...base };

    if (base.mapLat === defaultContent.neighbourhood.mapLat) {
      next.mapLat = cbLat;
    }
    if (base.mapLon === defaultContent.neighbourhood.mapLon) {
      next.mapLon = cbLon;
    }

    if (next.mapLat !== base.mapLat || next.mapLon !== base.mapLon) {
      await writeBlock(propertyId, "neighbourhood", next);
      neighbourhoodUpdated = true;
    }
  }

  // --- goodToKnow rows for Check-in / Check-out ---
  const cbCheckIn = cb.propertyPolicy?.propertyCheckInTime?.trim() || null;
  const cbCheckOut = cb.propertyPolicy?.propertyCheckOutTime?.trim() || null;
  if (cbCheckIn || cbCheckOut) {
    const existing =
      (await readBlock<ContentGoodToKnow>(propertyId, "goodToKnow")) ?? null;
    const base: ContentGoodToKnow = existing
      ? { ...defaultContent.goodToKnow, ...existing }
      : { ...defaultContent.goodToKnow };
    const next: ContentGoodToKnow = {
      ...base,
      rows: base.rows.map((r) => ({ ...r })),
    };

    const defaultCheckIn = defaultContent.goodToKnow.rows.find(
      (r) => r.label === "Check-in"
    )?.value;
    const defaultCheckOut = defaultContent.goodToKnow.rows.find(
      (r) => r.label === "Check-out"
    )?.value;

    let changed = false;
    for (const row of next.rows) {
      if (
        cbCheckIn &&
        row.label === "Check-in" &&
        row.value === defaultCheckIn
      ) {
        row.value = `From ${cbCheckIn}`;
        changed = true;
      }
      if (
        cbCheckOut &&
        row.label === "Check-out" &&
        row.value === defaultCheckOut
      ) {
        row.value = `By ${cbCheckOut}`;
        changed = true;
      }
    }

    if (changed) {
      await writeBlock(propertyId, "goodToKnow", next);
      goodToKnowUpdated = true;
    }
  }

  return {
    propertyId,
    contactUpdated,
    neighbourhoodUpdated,
    goodToKnowUpdated,
    propertyFieldsUpdated,
  };
}
