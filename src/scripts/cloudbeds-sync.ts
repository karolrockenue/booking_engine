// Manual trigger for the inventory sync. Useful while iterating before the
// webhook handler + cron are wired up.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-sync.ts [slug] [days]
//
// Default slug is "demo", default days is 90.

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { syncInventoryForProperty } from "../lib/cloudbeds/sync-inventory";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const days = parseInt(process.argv[3] ?? "90");

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (!property) {
    console.error(`Property "${slug}" not found`);
    process.exit(1);
  }

  console.log(
    `Syncing ${property.name} (slug=${slug}, cloudbedsPropertyId=${property.cloudbedsPropertyId ?? "none"}) for ${days} days...`
  );

  const result = await syncInventoryForProperty(property.id, days);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
