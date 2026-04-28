import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("Seeding test property...");

  // 1. Create property
  const [property] = await db
    .insert(schema.properties)
    .values({
      slug: "demo",
      name: "The Kensington Arms",
      domain: "localhost",
      currency: "GBP",
      timezone: "Europe/London",
      status: "live",
      theme: {
        name: "The Kensington Arms",
        slug: "kensington-arms",
        domain: "localhost",
        colors: {
          primary: "#2C3E50",
          secondary: "#C9A96E",
          accent: "#8B4513",
          background: "#FAF8F5",
          surface: "#FFFFFF",
          text: "#1A1A1A",
          textMuted: "#6B7280",
          border: "#E5E0D8",
          error: "#DC2626",
          success: "#059669",
        },
        typography: {
          headingFont: "Georgia, serif",
          bodyFont: "system-ui, sans-serif",
          headingWeight: "700",
          bodyWeight: "400",
          baseSize: "16px",
          scale: 1.25,
          headingLetterSpacing: "-0.02em",
          bodyLineHeight: "1.6",
        },
        layout: {
          maxWidth: "1280px",
          borderRadius: "2px",
          buttonRadius: "0px",
          cardRadius: "4px",
          sectionPadding: "96px",
          containerPadding: "24px",
        },
        style: {
          imageAspectRatio: "3:2",
          imageTreatment: "none",
          buttonStyle: "solid",
          navStyle: "transparent",
          heroStyle: "fullbleed",
          animationLevel: "subtle",
        },
        social: {
          instagram: null,
          facebook: null,
          tripadvisor: null,
        },
      },
    })
    .returning();

  console.log(`Created property: ${property.id}`);

  // 2. Create room types
  const [classicDouble] = await db
    .insert(schema.roomTypes)
    .values({
      propertyId: property.id,
      otaRoomId: "classic-double",
      name: "Classic Double",
      description:
        "A beautifully appointed room with a king-size bed, en-suite bathroom, and views over the garden.",
      maxOccupancy: 2,
      baseOccupancy: 2,
      amenities: ["Wi-Fi", "Air Conditioning", "Minibar", "Safe", "Hairdryer"],
      sortOrder: 1,
    })
    .returning();

  const [deluxeSuite] = await db
    .insert(schema.roomTypes)
    .values({
      propertyId: property.id,
      otaRoomId: "deluxe-suite",
      name: "Deluxe Suite",
      description:
        "Spacious suite with separate living area, premium amenities, and panoramic city views.",
      maxOccupancy: 3,
      baseOccupancy: 2,
      amenities: [
        "Wi-Fi",
        "Nespresso Machine",
        "Bathrobe & Slippers",
        "Balcony",
        "Minibar",
        "Safe",
      ],
      sortOrder: 2,
    })
    .returning();

  const [superiorTwin] = await db
    .insert(schema.roomTypes)
    .values({
      propertyId: property.id,
      otaRoomId: "superior-twin",
      name: "Superior Twin",
      description:
        "Light-filled room with two single beds, ideal for friends or colleagues travelling together.",
      maxOccupancy: 2,
      baseOccupancy: 2,
      amenities: ["Wi-Fi", "Air Conditioning", "Desk", "Safe", "Hairdryer"],
      sortOrder: 3,
    })
    .returning();

  console.log("Created 3 room types");

  // 3. Create rate plans
  const [classicRate] = await db
    .insert(schema.ratePlans)
    .values({
      propertyId: property.id,
      roomTypeId: classicDouble.id,
      otaRateId: "classic-double-standard",
      name: "Standard Rate",
      namePublic: "Best Available Rate",
      isPublic: true,
    })
    .returning();

  const [deluxeRate] = await db
    .insert(schema.ratePlans)
    .values({
      propertyId: property.id,
      roomTypeId: deluxeSuite.id,
      otaRateId: "deluxe-suite-standard",
      name: "Standard Rate",
      namePublic: "Best Available Rate",
      isPublic: true,
    })
    .returning();

  const [twinRate] = await db
    .insert(schema.ratePlans)
    .values({
      propertyId: property.id,
      roomTypeId: superiorTwin.id,
      otaRateId: "superior-twin-standard",
      name: "Standard Rate",
      namePublic: "Best Available Rate",
      isPublic: true,
    })
    .returning();

  console.log("Created 3 rate plans");

  // 4. Create inventory for next 90 days
  const today = new Date();
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

  const roomConfigs = [
    { roomTypeId: classicDouble.id, ratePlanId: classicRate.id, baseRate: 145, units: 5 },
    { roomTypeId: deluxeSuite.id, ratePlanId: deluxeRate.id, baseRate: 225, units: 3 },
    { roomTypeId: superiorTwin.id, ratePlanId: twinRate.id, baseRate: 165, units: 4 },
  ];

  for (let dayOffset = 0; dayOffset < 90; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = d.toISOString().split("T")[0];
    const isWeekend = d.getDay() === 5 || d.getDay() === 6; // Fri/Sat

    for (const config of roomConfigs) {
      // Weekend rates are 20% higher
      const rate = isWeekend
        ? Math.round(config.baseRate * 1.2)
        : config.baseRate;

      inventoryRows.push({
        propertyId: property.id,
        roomTypeId: config.roomTypeId,
        ratePlanId: config.ratePlanId,
        date: dateStr,
        unitsAvailable: config.units,
        rate: rate.toFixed(2),
        minStay: 1,
        maxStay: 14,
        closedArrival: false,
        closedDeparture: false,
      });
    }
  }

  // Insert in batches of 50
  for (let i = 0; i < inventoryRows.length; i += 50) {
    await db.insert(schema.inventory).values(inventoryRows.slice(i, i + 50));
  }

  console.log(`Created ${inventoryRows.length} inventory rows (90 days x 3 rooms)`);
  console.log("\nDone! Property ID:", property.id);
  console.log("You can now search availability at http://localhost:3000");
}

seed().catch(console.error);
