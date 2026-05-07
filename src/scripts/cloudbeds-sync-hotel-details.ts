// Smoke test for syncHotelDetailsForProperty — pulls hotel metadata from
// Cloudbeds and reports which content blocks were updated, then prints the
// post-sync state of the affected blocks for inspection.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-sync-hotel-details.ts [slug]
//
// Defaults: slug "demo".

import { db } from "../db";
import { properties, contentBlocks } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { syncHotelDetailsForProperty } from "../lib/cloudbeds/sync-hotel-details";

async function main() {
  const slug = process.argv[2] ?? "demo";

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (!property) {
    console.error(`Property "${slug}" not found.`);
    process.exit(1);
  }
  if (!property.cloudbedsAccessToken) {
    console.error(`Property "${slug}" has no Cloudbeds connection.`);
    process.exit(1);
  }

  console.log(`Property: ${property.name} (${property.id})`);
  console.log(`CB property ID: ${property.cloudbedsPropertyId ?? "(unresolved)"}\n`);

  const result = await syncHotelDetailsForProperty(property.id);

  console.log("Sync result:");
  console.log(`  contact updated:        ${result.contactUpdated}`);
  console.log(`  neighbourhood updated:  ${result.neighbourhoodUpdated}`);
  console.log(`  goodToKnow updated:     ${result.goodToKnowUpdated}`);

  const blocks = await db
    .select({ key: contentBlocks.key, content: contentBlocks.content })
    .from(contentBlocks)
    .where(
      and(
        eq(contentBlocks.propertyId, property.id),
        inArray(contentBlocks.key, ["contact", "neighbourhood", "goodToKnow"])
      )
    );

  console.log("\nPost-sync content blocks:");
  for (const b of blocks) {
    console.log(`\n[${b.key}]`);
    console.log(JSON.stringify(b.content, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
