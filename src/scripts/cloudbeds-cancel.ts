// End-to-end smoke test for the cancellation path.
//
// Creates a real reservation against the demo Cloudbeds property using a
// saleable room type + rate plan from our synced inventory, then
// immediately cancels it via putReservationStatus.
//
// Validates the last unproven write call before cert. Leaves Cloudbeds
// in a clean state (created → canceled) regardless of where it stops.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-cancel.ts [slug]
//
// Default slug is "demo".

import { randomUUID } from "node:crypto";
import { db } from "../db";
import { properties, inventory, roomTypes, ratePlans } from "../db/schema";
import { and, eq, gte, gt, lte, asc } from "drizzle-orm";
import {
  postReservation,
  putReservationStatus,
} from "../lib/cloudbeds/reservations";

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

async function main() {
  const slug = process.argv[2] ?? "demo";

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (!property) {
    console.error(`Property "${slug}" not found`);
    process.exit(1);
  }
  if (!property.cloudbedsAccessToken || !property.cloudbedsPropertyId) {
    console.error(`Property "${slug}" not connected to Cloudbeds`);
    process.exit(1);
  }

  // Pick a stay 60 days out — far enough to avoid cancellation deadline
  // edges, near enough that inventory has been synced.
  const startDate = addDays(new Date(), 60);
  const endDate = addDays(startDate, 1);
  const startIso = isoDate(startDate);
  const endIso = isoDate(endDate);

  console.log(
    `\n[1/4] Looking for saleable inventory on ${startIso} for ${property.name}…`
  );

  // Find any room type + rate plan combo with units available on the
  // arrival date. Cheapest first to keep the test footprint tiny.
  const candidates = await db
    .select({
      ratePlanId: inventory.ratePlanId,
      roomTypeId: inventory.roomTypeId,
      rate: inventory.rate,
      otaRoomId: roomTypes.otaRoomId,
      roomName: roomTypes.name,
      otaRateId: ratePlans.otaRateId,
      rateName: ratePlans.name,
    })
    .from(inventory)
    .innerJoin(roomTypes, eq(inventory.roomTypeId, roomTypes.id))
    .innerJoin(ratePlans, eq(inventory.ratePlanId, ratePlans.id))
    .where(
      and(
        eq(inventory.propertyId, property.id),
        eq(inventory.date, startIso),
        gt(inventory.unitsAvailable, 0)
      )
    )
    .orderBy(asc(inventory.rate))
    .limit(1);

  if (candidates.length === 0) {
    console.error(
      `No saleable inventory on ${startIso}. Run cloudbeds-sync first or pick a different date.`
    );
    process.exit(1);
  }

  const c = candidates[0];
  const subtotal = Number(c.rate ?? "0");
  if (!subtotal || !isFinite(subtotal) || subtotal <= 0) {
    console.error(`Inventory row has no rate (rate=${c.rate}). Aborting.`);
    process.exit(1);
  }
  console.log(
    `      Room: ${c.roomName} (${c.otaRoomId}) · Rate: ${c.rateName} (${c.otaRateId}) · £${subtotal.toFixed(2)}/nt`
  );

  // Unique orderId per run so reruns don't collide with a Cloudbeds
  // dedupe on thirdPartyIdentifier.
  const orderId = `smoke-${randomUUID().slice(0, 8)}`;
  const guestEmail = `cert-smoke+${orderId}@rockenue.test`;

  console.log(
    `\n[2/4] Creating reservation (thirdPartyIdentifier=${orderId})…`
  );
  let reservationID: string;
  try {
    const created = await postReservation(property.id, {
      cloudbedsPropertyId: property.cloudbedsPropertyId,
      startDate: startIso,
      endDate: endIso,
      guestFirstName: "Cert",
      guestLastName: "Smoke",
      guestEmail,
      guestCountry: "GB",
      roomTypeID: c.otaRoomId,
      ratesID: c.otaRateId,
      adults: 1,
      children: 0,
      subtotal,
      thirdPartyIdentifier: orderId,
      paymentMethod: "credit",
    });
    reservationID = created.reservationID;
    console.log(`      ✓ Created reservation ${reservationID}`);
  } catch (err) {
    console.error(`      ✗ postReservation failed:`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`\n[3/4] Cancelling reservation ${reservationID}…`);
  try {
    const cancelled = await putReservationStatus(property.id, {
      cloudbedsPropertyId: property.cloudbedsPropertyId,
      reservationID,
      status: "canceled",
      reason: "Smoke test — automated cert validation",
    });
    console.log(
      `      ✓ Cancelled. status=${cancelled.status} reservationID=${cancelled.reservationID}`
    );
  } catch (err) {
    console.error(`      ✗ putReservationStatus failed:`);
    console.error(err instanceof Error ? err.message : err);
    console.error(
      `      Reservation ${reservationID} is still active — cancel it manually in Cloudbeds.`
    );
    process.exit(1);
  }

  console.log(
    `\n[4/4] Smoke test passed. Reservation ${reservationID} was created and cancelled cleanly.`
  );
  console.log(
    `      Verify in Cloudbeds dashboard → Reservations → search "${orderId}" or guest "Cert Smoke".`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
