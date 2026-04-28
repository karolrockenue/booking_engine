import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import * as schema from "../db/schema";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

/**
 * Add 4 rate plans per room for the demo property:
 *   1. Flexible - Room Only (keep existing "Best Available Rate", rename)
 *   2. Flexible - Breakfast Included
 *   3. Non-Refundable - Room Only
 *   4. Non-Refundable - Breakfast Included
 */
async function seedRatePlans() {
  // Find the demo property
  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.slug, "demo"));

  if (!property) {
    console.error("Demo property not found. Run the main seed first.");
    return;
  }

  console.log(`Found property: ${property.name} (${property.id})`);

  // Get all room types
  const rooms = await db
    .select()
    .from(schema.roomTypes)
    .where(eq(schema.roomTypes.propertyId, property.id));

  console.log(`Found ${rooms.length} room types`);

  // Base rates per room (matching seed.ts)
  const baseRates: Record<string, number> = {
    "classic-double": 145,
    "deluxe-suite": 225,
    "superior-twin": 165,
  };

  const ratePlanTemplates = [
    {
      suffix: "flex-room",
      name: "Flexible Rate",
      namePublic: "Flexible - Room Only",
      priceMult: 1.0,
      isRefundable: true,
    },
    {
      suffix: "flex-bb",
      name: "Flexible + Breakfast",
      namePublic: "Flexible - Breakfast Included",
      priceMult: 1.12, // +12% for breakfast
      isRefundable: true,
    },
    {
      suffix: "nonref-room",
      name: "Non-Refundable Rate",
      namePublic: "Non-Refundable - Room Only",
      priceMult: 0.88, // -12% discount
      isRefundable: false,
    },
    {
      suffix: "nonref-bb",
      name: "Non-Refundable + Breakfast",
      namePublic: "Non-Refundable - Breakfast Included",
      priceMult: 1.0, // breakfast premium offsets NR discount
      isRefundable: false,
    },
  ];

  const today = new Date();

  for (const room of rooms) {
    const baseRate = baseRates[room.otaRoomId] ?? 150;
    console.log(`\nProcessing ${room.name} (base rate: £${baseRate})...`);

    // Delete existing rate plans and their inventory for this room
    const existingPlans = await db
      .select()
      .from(schema.ratePlans)
      .where(
        and(
          eq(schema.ratePlans.propertyId, property.id),
          eq(schema.ratePlans.roomTypeId, room.id)
        )
      );

    for (const plan of existingPlans) {
      // Delete booking day rates referencing bookings for this plan
      const bookingsForPlan = await db
        .select({ id: schema.bookings.id })
        .from(schema.bookings)
        .where(eq(schema.bookings.ratePlanId, plan.id));
      for (const b of bookingsForPlan) {
        await db
          .delete(schema.bookingDayRates)
          .where(eq(schema.bookingDayRates.bookingId, b.id));
      }
      // Delete bookings referencing this plan
      await db
        .delete(schema.bookings)
        .where(eq(schema.bookings.ratePlanId, plan.id));
      // Delete inventory
      await db
        .delete(schema.inventory)
        .where(
          and(
            eq(schema.inventory.propertyId, property.id),
            eq(schema.inventory.ratePlanId, plan.id)
          )
        );
      await db
        .delete(schema.ratePlans)
        .where(eq(schema.ratePlans.id, plan.id));
    }
    console.log(`  Deleted ${existingPlans.length} old rate plans + inventory`);

    // Create new rate plans with inventory
    for (const template of ratePlanTemplates) {
      const [plan] = await db
        .insert(schema.ratePlans)
        .values({
          propertyId: property.id,
          roomTypeId: room.id,
          otaRateId: `${room.otaRoomId}-${template.suffix}`,
          name: template.name,
          namePublic: template.namePublic,
          isPublic: true,
          isRefundable: template.isRefundable,
        })
        .returning();

      console.log(`  Created: ${template.namePublic} (${plan.id})`);

      // Create 90 days of inventory
      const inventoryRows: Array<{
        propertyId: string;
        roomTypeId: string;
        ratePlanId: string;
        date: string;
        unitsAvailable: number;
        rate: string;
        minStay: number;
        maxStay: number;
        closedArrival: boolean;
        closedDeparture: boolean;
      }> = [];

      for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + dayOffset);
        const dateStr = d.toISOString().split("T")[0];
        const isWeekend = d.getDay() === 5 || d.getDay() === 6;

        const weekdayRate = Math.round(baseRate * template.priceMult);
        const rate = isWeekend
          ? Math.round(weekdayRate * 1.2)
          : weekdayRate;

        inventoryRows.push({
          propertyId: property.id,
          roomTypeId: room.id,
          ratePlanId: plan.id,
          date: dateStr,
          unitsAvailable: 5,
          rate: rate.toFixed(2),
          minStay: 1,
          maxStay: 14,
          closedArrival: false,
          closedDeparture: false,
        });
      }

      for (let i = 0; i < inventoryRows.length; i += 50) {
        await db
          .insert(schema.inventory)
          .values(inventoryRows.slice(i, i + 50));
      }

      console.log(`    + ${inventoryRows.length} inventory rows`);
    }
  }

  console.log("\nDone! Each room now has 4 rate plans.");
}

seedRatePlans().catch(console.error);
