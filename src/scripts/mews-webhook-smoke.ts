// Phase-5 verification. Two parts:
//   A) Pure-logic tests of extractMewsSyncTargets — the only piece live demo
//      delivery can't exercise (Mews shared demo doesn't push General Webhooks
//      to arbitrary endpoints), so we assert the event-shape parsing directly.
//   B) Live mapping test: spin up a throwaway Mews-connected property against
//      the demo enterprise, feed handleMewsWebhookEvents a synthetic
//      ServiceOrderUpdated carrying that enterprise's Id, and confirm it maps to
//      our property and actually re-syncs the native availability table.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-webhook-smoke.ts

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
import {
  extractMewsSyncTargets,
  handleMewsWebhookEvents,
} from "../lib/pms/mews/webhooks";
import { syncMewsInventoryForProperty } from "../lib/pms/mews/sync-inventory";

const SLUG = "mews-p5-smoke";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

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

function partA() {
  console.log("\n── Part A: extractMewsSyncTargets (pure) ──");

  // Relevant events with enterprise ids.
  const a = extractMewsSyncTargets({
    Events: [
      { Discriminator: "ServiceOrderUpdated", Value: { EnterpriseId: "ent-1" } },
      { Discriminator: "ResourceBlockUpdated", Value: { EnterpriseId: "ent-1" } },
      { Discriminator: "ResourceBlockUpdated", Value: { EnterpriseId: "ent-2" } },
    ],
  });
  check("counts 3 relevant events", a.relevantEvents === 3, `got ${a.relevantEvents}`);
  check(
    "dedupes enterprise ids (ent-1, ent-2)",
    a.enterpriseIds.length === 2 &&
      a.enterpriseIds.includes("ent-1") &&
      a.enterpriseIds.includes("ent-2"),
    JSON.stringify(a.enterpriseIds)
  );

  // Irrelevant events are ignored.
  const b = extractMewsSyncTargets({
    Events: [
      { Discriminator: "CustomerUpdated", Value: { EnterpriseId: "ent-1" } },
      { Discriminator: "MessageAdded", Value: { EnterpriseId: "ent-1" } },
    ],
  });
  check("ignores non-inventory events", b.relevantEvents === 0, `got ${b.relevantEvents}`);
  check("no enterprise ids from irrelevant events", b.enterpriseIds.length === 0);

  // Case-insensitive + relevant-but-no-enterprise-id.
  const c = extractMewsSyncTargets({
    Events: [{ Discriminator: "serviceorderUPDATED", Value: {} }],
  });
  check("matches case-insensitively", c.relevantEvents === 1, `got ${c.relevantEvents}`);
  check("relevant event w/o EnterpriseId yields no target", c.enterpriseIds.length === 0);

  // Empty / malformed payloads don't throw.
  const d = extractMewsSyncTargets({});
  check("empty payload → 0 events", d.totalEvents === 0 && d.relevantEvents === 0);
  const e = extractMewsSyncTargets({ Events: undefined });
  check("undefined Events → 0 events", e.totalEvents === 0);
}

async function partB() {
  console.log("\n── Part B: live webhook → property → sync ──");
  const token = process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  const [existing] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, SLUG))
    .limit(1);
  if (existing) await cleanup(existing.id);

  const info = await fetchMewsConnectionInfo(token);
  const service =
    info.services.find((s) => s.name === "Accommodation (real)") ?? info.services[0];
  if (!service) throw new Error("No Reservable service on demo enterprise");
  if (!info.enterpriseId) throw new Error("Demo enterprise has no Id");

  const [property] = await db
    .insert(properties)
    .values({
      slug: SLUG,
      name: "Mews P5 Smoke",
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
  console.log(`  throwaway property ${propertyId} (enterprise ${info.enterpriseId})`);

  try {
    // Unknown enterprise → no match, no sync.
    const miss = await handleMewsWebhookEvents({
      Events: [
        { Discriminator: "ServiceOrderUpdated", Value: { EnterpriseId: "does-not-exist" } },
      ],
    });
    check(
      "unknown enterprise → 0 synced, 1 unmatched",
      miss.syncedProperties === 0 && miss.unmatchedEnterprises.length === 1,
      JSON.stringify(miss)
    );

    // Real enterprise → maps to our property and triggers a sync.
    const hit = await handleMewsWebhookEvents({
      Events: [
        { Discriminator: "ServiceOrderUpdated", Value: { EnterpriseId: info.enterpriseId } },
        { Discriminator: "ResourceBlockUpdated", Value: { EnterpriseId: info.enterpriseId } },
      ],
    });
    check(
      "known enterprise → 1 property synced, 0 unmatched",
      hit.syncedProperties === 1 && hit.unmatchedEnterprises.length === 0,
      JSON.stringify(hit)
    );

    // The handler dispatches syncMewsInventoryForProperty fire-and-forget, so
    // its completion is racy to observe from here. Verify the dispatched call
    // itself deterministically: run the exact same sync the handler triggers
    // and confirm it populates the native availability table for this property.
    console.log("  running the dispatched sync deterministically (short window)...");
    await syncMewsInventoryForProperty(propertyId, 3);
    const rows = await db
      .select({ id: mewsCategoryAvailability.propertyId })
      .from(mewsCategoryAvailability)
      .where(eq(mewsCategoryAvailability.propertyId, propertyId));
    check(
      "dispatched Mews sync populates mews_category_availability",
      rows.length > 0,
      `got ${rows.length} rows`
    );
  } finally {
    await cleanup(propertyId);
    console.log("  cleaned up throwaway property");
  }
}

async function main() {
  partA();
  await partB();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
