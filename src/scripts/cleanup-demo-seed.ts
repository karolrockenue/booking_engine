// One-shot cleanup: removes the old hand-seeded room types / rate plans /
// inventory rows from the demo property, keeping only what came from the
// Cloudbeds sync. Identifies seed rows by their otaRoomId / otaRateId being
// non-numeric (the old seed used slug-style IDs like "classic-double"; CB
// returns numeric IDs like "657147").

import { db } from "../db";
import {
  properties,
  roomTypes,
  ratePlans,
  inventory,
  bookings,
} from "../db/schema";
import { and, eq, inArray, or, sql } from "drizzle-orm";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!property) throw new Error(`Property ${slug} not found`);

  console.log(`Cleaning up seed data for ${property.name}\n`);

  // Find seed (non-numeric otaRoomId) room types and rate plans for this property.
  const seedRooms = await db
    .select({ id: roomTypes.id, otaRoomId: roomTypes.otaRoomId })
    .from(roomTypes)
    .where(
      and(
        eq(roomTypes.propertyId, property.id),
        sql`${roomTypes.otaRoomId} !~ '^[0-9]+$'`
      )
    );

  const seedPlans = await db
    .select({ id: ratePlans.id, otaRateId: ratePlans.otaRateId })
    .from(ratePlans)
    .where(
      and(
        eq(ratePlans.propertyId, property.id),
        sql`${ratePlans.otaRateId} !~ '^[0-9]+$'`
      )
    );

  console.log(`Seed room types found: ${seedRooms.length}`);
  for (const r of seedRooms) console.log(`  - ${r.otaRoomId}`);
  console.log(`Seed rate plans found: ${seedPlans.length}`);
  for (const r of seedPlans) console.log(`  - ${r.otaRateId}`);

  if (seedRooms.length === 0 && seedPlans.length === 0) {
    console.log("\nNothing to clean. Exiting.");
    return;
  }

  const seedRoomIds = seedRooms.map((r) => r.id);
  const seedPlanIds = seedPlans.map((r) => r.id);

  // Block the cleanup if any booking still references seed data — that's
  // unexpected and worth a manual look rather than silent deletion.
  const bookingFilters = [];
  if (seedRoomIds.length > 0)
    bookingFilters.push(inArray(bookings.roomTypeId, seedRoomIds));
  if (seedPlanIds.length > 0)
    bookingFilters.push(inArray(bookings.ratePlanId, seedPlanIds));

  if (bookingFilters.length > 0) {
    const blockingBookings = await db
      .select({ id: bookings.id, orderId: bookings.orderId })
      .from(bookings)
      .where(and(eq(bookings.propertyId, property.id), or(...bookingFilters)));

    if (blockingBookings.length > 0) {
      console.error(
        `\nABORT: ${blockingBookings.length} booking(s) reference seed rooms/plans:`
      );
      for (const b of blockingBookings)
        console.error(`  - ${b.orderId} (${b.id})`);
      process.exit(1);
    }
  }

  // Delete in FK-safe order: inventory → ratePlans → roomTypes.
  let deletedInventory = 0;
  const inventoryFilters = [];
  if (seedRoomIds.length > 0)
    inventoryFilters.push(inArray(inventory.roomTypeId, seedRoomIds));
  if (seedPlanIds.length > 0)
    inventoryFilters.push(inArray(inventory.ratePlanId, seedPlanIds));

  if (inventoryFilters.length > 0) {
    const res = await db
      .delete(inventory)
      .where(and(eq(inventory.propertyId, property.id), or(...inventoryFilters)))
      .returning({ id: inventory.id });
    deletedInventory = res.length;
  }

  let deletedPlans = 0;
  if (seedPlanIds.length > 0) {
    const res = await db
      .delete(ratePlans)
      .where(inArray(ratePlans.id, seedPlanIds))
      .returning({ id: ratePlans.id });
    deletedPlans = res.length;
  }

  let deletedRooms = 0;
  if (seedRoomIds.length > 0) {
    const res = await db
      .delete(roomTypes)
      .where(inArray(roomTypes.id, seedRoomIds))
      .returning({ id: roomTypes.id });
    deletedRooms = res.length;
  }

  console.log(
    `\nDeleted: ${deletedInventory} inventory rows, ${deletedPlans} rate plans, ${deletedRooms} room types`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
