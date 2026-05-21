// Google Hotel List XML feed generator (Sprint 1).
//
// Emits the <listings> document Google Hotel Center pulls to learn which
// properties exist, so it can match them to Google Maps / Business Profiles.
// This is identity only — NOT prices/availability (that's the ARI Push pipeline,
// a later sprint). Validates against http://www.gstatic.com/localfeed/local_feed.xsd
//
// Field sources (from the `properties` row + its `content_blocks`):
//   id         roc-<properties.id>            (permanent, never reused)
//   name       properties.name
//   address    content_blocks.contact.addressLines  (parsed → addr1/city/postal/country)
//   lat/long   content_blocks.neighbourhood.mapLat/mapLon
//   phone      content_blocks.contact.reservationsPhone
//   website    properties.domain             (omitted when null — see blueprint §11)
//
// See "Google Hotel Center — Blueprint.md" §5 + §11.

import { db } from "@/db";
import { properties, contentBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import type {
  ContactBlock,
  NeighbourhoodBlock,
  ParsedAddress,
  HotelListFeedResult,
} from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// UK-style postcode (covers the v1 UK-only scope).
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})\b/i;

// Parse the free-text addressLines (e.g. ["202-204 Sussex Gardens",
// "London W2 3UA", "GB"]) into Google's structured components. Heuristic by
// design — see blueprint §11; structured per-field columns are a future
// improvement.
export function parseAddress(lines: string[] | undefined): ParsedAddress {
  const arr = (lines ?? []).map((l) => l.trim()).filter(Boolean);

  // Trailing 2-letter uppercase token = ISO country code.
  let country = "GB";
  if (arr.length > 0 && /^[A-Z]{2}$/.test(arr[arr.length - 1])) {
    country = arr.pop() as string;
  }

  const addr1 = arr[0];
  let city: string | undefined;
  let postal: string | undefined;

  for (const line of arr.slice(1)) {
    const m = line.match(UK_POSTCODE);
    if (m) {
      postal = m[1].toUpperCase().replace(/\s+/g, " ");
      const remainder = line.replace(m[1], "").replace(/[,\s]+$/, "").trim();
      if (remainder) city = remainder;
    } else if (!city) {
      city = line;
    }
  }

  return { addr1, city, postal, country };
}

export async function buildHotelListFeed(): Promise<HotelListFeedResult> {
  const props = await db.select().from(properties);
  const warnings: string[] = [];
  const listings: string[] = [];
  let withWebsite = 0;

  for (const p of props) {
    const blocks = await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.propertyId, p.id));

    const contact = (blocks.find((b) => b.key === "contact")?.content ??
      {}) as ContactBlock;
    const nb = (blocks.find((b) => b.key === "neighbourhood")?.content ??
      {}) as NeighbourhoodBlock;

    const addr = parseAddress(contact.addressLines);
    const lat = typeof nb.mapLat === "number" ? nb.mapLat : undefined;
    const lon = typeof nb.mapLon === "number" ? nb.mapLon : undefined;
    const phone = contact.reservationsPhone?.trim();

    // Google requires a phone OR lat/long on every listing.
    if (!phone && (lat === undefined || lon === undefined)) {
      warnings.push(
        `${p.slug}: no phone and no lat/long — skipped (Google requires one).`
      );
      continue;
    }
    if (!addr.addr1) warnings.push(`${p.slug}: missing street address.`);
    if (!p.domain)
      warnings.push(
        `${p.slug}: no domain — <website> omitted (won't match/badge until set).`
      );

    const lines: string[] = [];
    lines.push(`  <listing>`);
    lines.push(`    <id>${esc(`roc-${p.id}`)}</id>`);
    lines.push(`    <name>${esc(p.name)}</name>`);
    lines.push(`    <address format="simple">`);
    if (addr.addr1)
      lines.push(`      <component name="addr1">${esc(addr.addr1)}</component>`);
    if (addr.city)
      lines.push(`      <component name="city">${esc(addr.city)}</component>`);
    if (addr.postal)
      lines.push(
        `      <component name="postal_code">${esc(addr.postal)}</component>`
      );
    lines.push(`    </address>`);
    lines.push(`    <country>${esc(addr.country)}</country>`);
    if (lat !== undefined) lines.push(`    <latitude>${lat}</latitude>`);
    if (lon !== undefined) lines.push(`    <longitude>${lon}</longitude>`);
    if (phone) lines.push(`    <phone type="main">${esc(phone)}</phone>`);
    lines.push(`    <category>hotel</category>`);

    if (p.domain) {
      withWebsite++;
      const website = /^https?:\/\//i.test(p.domain)
        ? p.domain
        : `https://${p.domain}`;
      lines.push(`    <content>`);
      lines.push(`      <attributes>`);
      lines.push(`        <website>${esc(website)}</website>`);
      lines.push(
        `        <client_attr name="alternate_hotel_id">${esc(p.domain)}</client_attr>`
      );
      lines.push(`      </attributes>`);
      lines.push(`    </content>`);
    }

    lines.push(`  </listing>`);
    listings.push(lines.join("\n"));
  }

  const xml =
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<listings xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
      `    xsi:noNamespaceSchemaLocation="http://www.gstatic.com/localfeed/local_feed.xsd">`,
      `  <language>en</language>`,
      ...listings,
      `</listings>`,
    ].join("\n") + "\n";

  return {
    xml,
    total: props.length,
    included: listings.length,
    withWebsite,
    warnings,
  };
}
