// Phase-4 write-path verification, through the real PmsAdapter. Creates a
// throwaway Mews-connected property, syncs, picks a bookable room+rate from
// getAvailability, then runs createReservation → recordPayment → cancelReservation
// via getPmsAdapter (exactly what the booking flow does). Cancels + cleans up.
// Safe to re-run.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-write-smoke.ts

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
import { getPmsAdapter } from "../lib/pms";

const SLUG = "mews-p4-smoke";

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

  const [property] = await db
    .insert(properties)
    .values({
      slug: SLUG,
      name: "Mews P4 Smoke",
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
        externalPaymentType: info.externalPaymentTypes[0] ?? "Cash",
        currency: info.currency,
      },
    })
    .returning();

  const propertyId = property.id;
  console.log(`Throwaway property ${propertyId} | service ${service.name}`);

  const adapter = getPmsAdapter(property);
  let reservationId: string | undefined;

  try {
    // Sync a short window, then read availability ~21 days out for 2 nights.
    console.log("Syncing inventory (3 days)...");
    await adapter.syncInventory(30);

    const ci = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const co = new Date(Date.now() + 23 * 864e5).toISOString().slice(0, 10);
    const options = await adapter.getAvailability(ci, co, 1);
    console.log(`Availability ${ci}→${co}: ${options.length} options`);
    const opt = options.find((o) => o.totalPrice > 0);
    if (!opt) throw new Error("No bookable option found in window");
    console.log(
      `Booking: ${opt.roomType.name} · ${opt.ratePlan.name} · total=${opt.totalPrice} · nightly=${opt.nightlyRates.map((n) => n.rate).join(",")}`
    );

    // createReservation — exactly the params the booking route builds.
    const created = await adapter.createReservation({
      startDate: ci,
      endDate: co,
      guestFirstName: "Smoke",
      guestLastName: "Tester",
      guestEmail: `p4smoke+${Date.now()}@example.com`,
      guestCountry: "GB",
      roomTypeId: opt.roomType.otaRoomId,
      rateId: opt.ratePlan.otaRateId,
      adults: 1,
      children: 0,
      roomSubtotal: opt.totalPrice,
      orderId: `p4smoke-${Date.now()}`,
      nightlyRates: opt.nightlyRates,
    });
    reservationId = created.pmsReservationId;
    console.log(`✓ createReservation → ${reservationId} (group ${created.pmsGroupId})`);

    // recordPayment — external payment referencing a (fake) Stripe PI.
    const pay = await adapter.recordPayment({
      reservationId,
      amount: opt.totalPrice,
      type: "Cash",
      description: "Stripe pi_p4smoke_fake (smoke)",
      externalIdentifier: "pi_p4smoke_fake",
    });
    console.log(`✓ recordPayment → ${pay.pmsPaymentId}`);

    // cancelReservation
    await adapter.cancelReservation({ reservationId, reason: "P4 smoke cleanup" });
    console.log(`✓ cancelReservation → OK`);
    reservationId = undefined;

    console.log("\nP4 write path verified end-to-end via the adapter.");
  } finally {
    // Best-effort cancel if we created a reservation but a later step threw.
    if (reservationId) {
      try {
        await adapter.cancelReservation({ reservationId, reason: "P4 smoke cleanup" });
        console.log(`✓ cancelled orphaned reservation ${reservationId}`);
      } catch (e) {
        console.error(`!!! could not cancel ${reservationId}:`, e instanceof Error ? e.message : e);
      }
    }
    console.log("Cleaning up throwaway property...");
    await cleanup(propertyId);
    console.log("Done.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nSMOKE FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
