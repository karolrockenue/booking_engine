// Debug: dump raw /getHotelDetails response so we can see exactly what CB returns.

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { cloudbeds } from "../lib/cloudbeds/client";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!property) throw new Error(`No property "${slug}"`);
  if (!property.cloudbedsPropertyId) throw new Error("no cb property id");

  const res = await cloudbeds(property.id, "/getHotelDetails", {
    query: { propertyID: property.cloudbedsPropertyId },
  });
  console.log(JSON.stringify(res, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
