import { db } from "../db";
import { properties, roomTypes, ratePlans, inventory } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [p] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!p) throw new Error(`Property ${slug} not found`);

  console.log(`\nProperty: ${p.name} (cloudbedsPropertyId=${p.cloudbedsPropertyId})\n`);

  const rooms = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.propertyId, p.id));
  console.log("Room types:");
  for (const r of rooms) {
    console.log(`  ${r.otaRoomId}  ${r.name}  maxOccupancy=${r.maxOccupancy}`);
  }

  const plans = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.propertyId, p.id));
  console.log("\nRate plans:");
  for (const rp of plans) {
    console.log(
      `  ${rp.otaRateId}  name="${rp.name}"  public="${rp.namePublic ?? "—"}"  refundable=${rp.isRefundable}`
    );
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inventory)
    .where(eq(inventory.propertyId, p.id));
  console.log(`\nInventory rows: ${count}`);

  const sample = await db
    .select()
    .from(inventory)
    .where(eq(inventory.propertyId, p.id))
    .limit(3);
  console.log("\nSample inventory rows:");
  for (const i of sample) {
    console.log(
      `  ${i.date}  rate=${i.rate}  units=${i.unitsAvailable}  minStay=${i.minStay}  cArr=${i.closedArrival}  cDep=${i.closedDeparture}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
