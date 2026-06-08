// Verify Mews sold-out (CheckOverbooking) maps to our typed PmsSoldOutError
// (plan §11/§7.1). Demo inventory is abundant, so we force it: pick the
// lowest-availability category/night with a sellable rate and book it until Mews
// rejects. Asserts createMewsReservation throws PmsSoldOutError (not a raw
// MewsApiError). Tracks + cancels every reservation it creates; self-cleaning.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-soldout-probe.ts

import { db } from "../db";
import {
  properties,
  roomTypes,
  ratePlans,
  mewsCategoryAvailability,
  mewsRatePrices,
  contentBlocks,
} from "../db/schema";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { getMewsCredentials } from "../lib/pms/mews/credentials";
import { createMewsReservation } from "../lib/pms/mews/reservations";
import { cancelMewsReservation } from "../lib/pms/mews/reservations";
import { PmsSoldOutError } from "../lib/pms/errors";

const SLUG = "mews-soldout-probe";
const CAP = 40; // safety cap on booking attempts

async function cleanup(propertyId: string) {
  await db.delete(mewsRatePrices).where(eq(mewsRatePrices.propertyId, propertyId));
  await db.delete(mewsCategoryAvailability).where(eq(mewsCategoryAvailability.propertyId, propertyId));
  await db.delete(ratePlans).where(eq(ratePlans.propertyId, propertyId));
  await db.delete(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, propertyId));
  await db.delete(properties).where(eq(properties.id, propertyId));
}

async function main() {
  const token = process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  const [stale] = await db.select({ id: properties.id }).from(properties).where(eq(properties.slug, SLUG)).limit(1);
  if (stale) await cleanup(stale.id);

  const info = await fetchMewsConnectionInfo(token);
  const service = info.services.find((s) => s.name === "Accommodation (real)") ?? info.services[0];
  if (!service) throw new Error("No Reservable service");

  const [property] = await db.insert(properties).values({
    slug: SLUG, name: "Mews Soldout Probe", theme: {}, pmsType: "mews",
    timezone: info.timezone || "Europe/London", currency: info.currency || "GBP",
    pmsCredentials: {
      accessTokenEnc: encryptToken(token), serviceId: service.id, timezone: info.timezone,
      enterpriseId: info.enterpriseId, taxMode: info.taxMode,
      externalPaymentType: info.externalPaymentTypes[0] ?? "Cash", currency: info.currency,
    },
  }).returning();
  const propertyId = property.id;
  const creds = await getMewsCredentials(propertyId);
  const made: string[] = [];

  try {
    const { getPmsAdapter } = await import("../lib/pms");
    await getPmsAdapter(property).syncInventory(60);

    // Lowest-availability category/date that also has a sellable rate price,
    // starting at least a few days out (avoid same-day rules).
    // Two simple queries (no join — the neon-http driver chokes on this 3-col
    // join here): lowest-availability category/dates, then a sellable rate for
    // one of them.
    const minDate = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    const avail = await db
      .select({
        categoryId: mewsCategoryAvailability.categoryId,
        date: mewsCategoryAvailability.date,
        units: mewsCategoryAvailability.unitsAvailable,
      })
      .from(mewsCategoryAvailability)
      .where(
        and(
          eq(mewsCategoryAvailability.propertyId, propertyId),
          sql`${mewsCategoryAvailability.date} >= ${minDate}`
        )
      )
      .orderBy(asc(mewsCategoryAvailability.unitsAvailable), asc(mewsCategoryAvailability.date))
      .limit(200);

    let target: { categoryId: string; date: string; units: number; rateId: string; price: string } | undefined;
    for (const a of avail) {
      const prices = await db
        .select({ rateId: mewsRatePrices.rateId, price: mewsRatePrices.price })
        .from(mewsRatePrices)
        .where(
          and(
            eq(mewsRatePrices.propertyId, propertyId),
            eq(mewsRatePrices.categoryId, a.categoryId),
            eq(mewsRatePrices.date, String(a.date)),
            isNotNull(mewsRatePrices.price)
          )
        )
        .limit(5);
      const p = prices.find((x) => Number(x.price) > 0);
      if (p) {
        target = { categoryId: a.categoryId, date: String(a.date), units: a.units, rateId: p.rateId, price: p.price! };
        break;
      }
    }
    if (!target) throw new Error("No category/date with a sellable rate found");
    const ci = String(target.date);
    const co = new Date(new Date(`${ci}T00:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10);
    const price = Number(target.price);
    console.log(
      `Target category ${target.categoryId} on ${ci} (cached units=${target.units}) · rate ${target.rateId} · £${price}/night`
    );
    console.log(`Booking 1-night stays until Mews rejects (cap ${CAP})…\n`);

    let soldOut: PmsSoldOutError | undefined;
    let wrongError: unknown;
    for (let i = 1; i <= CAP; i++) {
      try {
        const res = await createMewsReservation(creds, {
          orderId: `soldout-${Date.now()}-${i}`,
          startDate: ci, endDate: co,
          categoryId: target.categoryId, rateId: target.rateId,
          adults: 1,
          guest: { lastName: "Soldout", firstName: "Probe", email: `soldout+${Date.now()}-${i}@example.com`, nationalityCode: "GB" },
          nightlyRates: [price],
        });
        made.push(res.pmsReservationId);
        process.stdout.write(`  booked #${i} (${res.pmsReservationId.slice(0, 8)})  `);
        if (i % 5 === 0) process.stdout.write("\n");
      } catch (e) {
        if (e instanceof PmsSoldOutError) {
          soldOut = e;
          console.log(`\n\n🎯 Sold out on attempt #${i} (after ${made.length} successful bookings)`);
        } else {
          wrongError = e;
        }
        break;
      }
    }

    console.log("\n=== RESULT ===");
    if (soldOut) {
      console.log(`✅ PASS — createMewsReservation threw PmsSoldOutError: "${soldOut.message}"`);
    } else if (wrongError) {
      console.log(
        `❌ FAIL — threw a non-sold-out error: ${wrongError instanceof Error ? `${wrongError.name}: ${wrongError.message}` : String(wrongError)}`
      );
    } else {
      console.log(`⚠ INCONCLUSIVE — no rejection within ${CAP} attempts (category had ≥${CAP} units).`);
    }
  } finally {
    console.log(`\nCleaning up ${made.length} reservations…`);
    for (const id of made) {
      try { await cancelMewsReservation(creds, id, "soldout probe cleanup"); } catch { /* noop */ }
    }
    await cleanup(propertyId);
    console.log("Cleaned up throwaway property. Done.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\nPROBE CRASHED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
