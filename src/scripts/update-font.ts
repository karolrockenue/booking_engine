import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

async function updateFont() {
  const [property] = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.slug, "demo"));

  if (!property) {
    console.error("Demo property not found");
    return;
  }

  const theme = property.theme as Record<string, unknown>;
  const typography = theme.typography as Record<string, unknown>;

  typography.headingFont = "'Inter', system-ui, sans-serif";
  typography.bodyFont = "'Inter', system-ui, sans-serif";
  typography.headingWeight = "600";

  await db
    .update(schema.properties)
    .set({ theme })
    .where(eq(schema.properties.id, property.id));

  console.log("Updated demo property fonts to Inter");
}

updateFont().catch(console.error);
