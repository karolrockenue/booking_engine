import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function update() {
  const all = await db.select().from(schema.properties);

  for (const p of all) {
    const theme = p.theme as Record<string, unknown>;

    // Add missing fields if not present
    if (!theme.contact) {
      if (p.slug === "demo") {
        theme.contact = {
          address: "12 Kensington Court, London W8 5DL",
          phone: "+44 20 7937 1234",
          email: "reservations@kensingtonarms.com",
        };
        theme.hero = {
          headline: "The Kensington Arms",
          subheadline: "Boutique luxury in the heart of Kensington",
          imageUrl: null,
          overlayOpacity: 0.45,
        };
        theme.nav = {
          links: [],
          bookingCtaText: "Book Now",
        };
        theme.social = {
          instagram: "https://instagram.com/kensingtonarms",
          facebook: null,
          tripadvisor: "https://tripadvisor.com/kensingtonarms",
        };
      } else if (p.slug === "urbanstay") {
        theme.contact = {
          address: "Friedrichstrasse 42, 10117 Berlin",
          phone: "+49 30 1234 5678",
          email: "hello@urbanstay-apartments.com",
        };
        theme.hero = {
          headline: "UrbanStay Apartments",
          subheadline: "Modern living in the heart of Berlin",
          imageUrl: null,
          overlayOpacity: 0.5,
        };
        theme.nav = {
          links: [],
          bookingCtaText: "Book Now",
        };
      }
    }

    await db
      .update(schema.properties)
      .set({ theme })
      .where(eq(schema.properties.id, p.id));

    console.log(`Updated ${p.name}`);
  }

  console.log("Done!");
}

update().catch(console.error);
