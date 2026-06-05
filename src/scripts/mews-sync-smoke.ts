// Phase-3 read-path verification. Creates a temporary Mews-connected property
// against the demo enterprise, runs the full read path (inventory sync → native
// tables → getAvailability + hotel-details sync), prints results, and cleans up
// — proving the pipeline end-to-end without touching any real property. Safe to
// re-run (wipes its own leftover first).
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-sync-smoke.ts

import { db } from "../db";
import {
  properties,
  roomTypes,
  ratePlans,
  mewsCategoryAvailability,
  mewsRatePrices,
  contentBlocks,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { syncMewsInventoryForProperty } from "../lib/pms/mews/sync-inventory";
import { syncMewsHotelDetailsForProperty } from "../lib/pms/mews/sync-hotel-details";
import { computeMewsAvailability } from "../lib/pms/mews/availability";

const SLUG = "mews-p3-smoke";
const DAYS = 7;

async function cleanup(propertyId: string) {
  await db.delete(mewsRatePrices).where(eq(mewsRatePrices.propertyId, propertyId));
  await db
    .delete(mewsCategoryAvailability)
    .where(eq(mewsCategoryAvailability.propertyId, propertyId));
  await db.delete(ratePlans).where(eq(ratePlans.propertyId, propertyId));
  await db.delete(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, propertyId));
  await db.delete(properties).where(eq(properties.id, propertyId));
}

async function main() {
  const token = process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  // Wipe any leftover from a prior run.
  const [existing] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, SLUG))
    .limit(1);
  if (existing) await cleanup(existing.id);

  // Mirror the connect flow: pull canonical enterprise values, pick the
  // "Accommodation (real)" reservable service (else the first reservable).
  const info = await fetchMewsConnectionInfo(token);
  const service =
    info.services.find((s) => s.name === "Accommodation (real)") ?? info.services[0];
  if (!service) throw new Error("No Reservable service on demo enterprise");
  console.log(
    `Enterprise: ${info.enterpriseName} | tz=${info.timezone} | tax=${info.taxMode} | cur=${info.currency}`
  );
  console.log(`Service: ${service.name} (${service.id})`);

  const [property] = await db
    .insert(properties)
    .values({
      slug: SLUG,
      name: "Mews P3 Smoke",
      theme: {},
      pmsType: "mews",
      timezone: info.timezone || "Europe/London",
      currency: info.currency || "GBP",
      pmsCredentials: {
        accessTokenEnc: encryptToken(token),
        serviceId: service.id,
        timezone: info.timezone,
        enterpriseId: info.enterpriseId,
        taxMode: info.taxMode,
        externalPaymentType: info.externalPaymentTypes[0] ?? null,
        currency: info.currency,
      },
    })
    .returning({ id: properties.id });

  const propertyId = property.id;
  console.log(`\nCreated throwaway property ${propertyId}\n`);

  try {
    console.log(`Running inventory sync (${DAYS} days)...`);
    const result = await syncMewsInventoryForProperty(propertyId, DAYS);
    console.log(JSON.stringify(result, null, 2));

    console.log("\nRunning hotel-details sync...");
    await syncMewsHotelDetailsForProperty(propertyId);
    const [refreshed] = await db
      .select({ name: properties.name, currency: properties.currency, tz: properties.timezone })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    console.log("property after details sync:", JSON.stringify(refreshed));

    // Read availability for a 2-night stay starting +2 days.
    const ci = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const co = new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10);
    console.log(`\nComputing availability ${ci} → ${co} (1 adult)...`);
    const avail = await computeMewsAvailability(propertyId, ci, co, 1);
    console.log(`Got ${avail.length} room×rate options. First 3:`);
    for (const r of avail.slice(0, 3)) {
      console.log(
        `  ${r.roomType.name} · ${r.ratePlan.name} · ${r.nights}n · total=${r.totalPrice} · nightly=${r.nightlyRates
          .map((n) => n.rate)
          .join(",")}`
      );
    }

    // Sanity: distinct categories priced vs available.
    const catCount = await db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(eq(roomTypes.propertyId, propertyId));
    const rpCount = await db
      .select({ id: ratePlans.id })
      .from(ratePlans)
      .where(eq(ratePlans.propertyId, propertyId));
    console.log(
      `\nDB: ${catCount.length} room_types, ${rpCount.length} rate_plans (room_type_id NULL for all)`
    );
  } finally {
    console.log("\nCleaning up throwaway property...");
    await cleanup(propertyId);
    console.log("Done.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nSMOKE FAILED:", e instanceof Error ? e.message : e);
    if (e && typeof e === "object" && "body" in e) {
      console.error("body:", JSON.stringify((e as { body: unknown }).body, null, 2).slice(0, 800));
    }
    process.exit(1);
  });
