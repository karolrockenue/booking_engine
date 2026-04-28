import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("Seeding second property (modern aparthotel)...");

  const [property] = await db
    .insert(schema.properties)
    .values({
      slug: "urbanstay",
      name: "UrbanStay Apartments",
      domain: null,
      currency: "EUR",
      timezone: "Europe/Berlin",
      status: "live",
      theme: {
        name: "UrbanStay Apartments",
        slug: "urbanstay",
        domain: "",
        colors: {
          primary: "#0F172A",
          secondary: "#3B82F6",
          accent: "#F59E0B",
          background: "#F8FAFC",
          surface: "#FFFFFF",
          text: "#0F172A",
          textMuted: "#64748B",
          border: "#E2E8F0",
          error: "#EF4444",
          success: "#22C55E",
        },
        typography: {
          headingFont: "system-ui, -apple-system, sans-serif",
          bodyFont: "system-ui, -apple-system, sans-serif",
          headingWeight: "800",
          bodyWeight: "400",
          baseSize: "16px",
          scale: 1.2,
          headingLetterSpacing: "-0.03em",
          bodyLineHeight: "1.5",
        },
        layout: {
          maxWidth: "1200px",
          borderRadius: "8px",
          buttonRadius: "8px",
          cardRadius: "12px",
          sectionPadding: "80px",
          containerPadding: "20px",
        },
        style: {
          imageAspectRatio: "16:9",
          imageTreatment: "rounded",
          buttonStyle: "solid",
          navStyle: "solid",
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

  const [studio] = await db
    .insert(schema.roomTypes)
    .values({
      propertyId: property.id,
      otaRoomId: "studio-apt",
      name: "Studio Apartment",
      description: "Compact studio with kitchenette, workspace, and city views. Perfect for solo travellers.",
      maxOccupancy: 2,
      baseOccupancy: 1,
      amenities: ["Wi-Fi", "Kitchenette", "Washing Machine", "Smart TV", "Workspace"],
      sortOrder: 1,
    })
    .returning();

  const [oneBed] = await db
    .insert(schema.roomTypes)
    .values({
      propertyId: property.id,
      otaRoomId: "one-bed-apt",
      name: "One-Bedroom Apartment",
      description: "Spacious apartment with separate bedroom, full kitchen, and living area.",
      maxOccupancy: 3,
      baseOccupancy: 2,
      amenities: ["Wi-Fi", "Full Kitchen", "Washing Machine", "Smart TV", "Balcony", "Workspace"],
      sortOrder: 2,
    })
    .returning();

  console.log("Created 2 room types");

  const [studioRate] = await db
    .insert(schema.ratePlans)
    .values({
      propertyId: property.id,
      roomTypeId: studio.id,
      otaRateId: "studio-flex",
      name: "Flexible Rate",
      namePublic: "Flexible Rate",
      isPublic: true,
    })
    .returning();

  const [oneBedRate] = await db
    .insert(schema.ratePlans)
    .values({
      propertyId: property.id,
      roomTypeId: oneBed.id,
      otaRateId: "one-bed-flex",
      name: "Flexible Rate",
      namePublic: "Flexible Rate",
      isPublic: true,
    })
    .returning();

  console.log("Created 2 rate plans");

  // Inventory for 90 days
  const today = new Date();
  const rows: Array<{
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

  const configs = [
    { roomTypeId: studio.id, ratePlanId: studioRate.id, baseRate: 89, units: 8 },
    { roomTypeId: oneBed.id, ratePlanId: oneBedRate.id, baseRate: 129, units: 5 },
  ];

  for (let d = 0; d < 90; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];
    const isWeekend = date.getDay() === 5 || date.getDay() === 6;

    for (const c of configs) {
      rows.push({
        propertyId: property.id,
        roomTypeId: c.roomTypeId,
        ratePlanId: c.ratePlanId,
        date: dateStr,
        unitsAvailable: c.units,
        rate: (isWeekend ? Math.round(c.baseRate * 1.15) : c.baseRate).toFixed(2),
        minStay: 1,
        maxStay: 30,
        closedArrival: false,
        closedDeparture: false,
      });
    }
  }

  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(schema.inventory).values(rows.slice(i, i + 50));
  }

  console.log(`Created ${rows.length} inventory rows`);
  console.log(`\nDone! To view this property locally: http://localhost:3000/?property=urbanstay`);
}

seed().catch(console.error);
