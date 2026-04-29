// Subscribe a property to all Cloudbeds webhook events we care about.
// Idempotent — already-subscribed events are skipped.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-subscribe.ts [slug]
//
// Default slug is "demo".

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { subscribeWebhooksForProperty } from "../lib/cloudbeds/webhook-subscriptions";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [p] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!p) throw new Error(`Property ${slug} not found`);

  console.log(
    `Subscribing webhooks for ${p.name} (cloudbedsPropertyId=${p.cloudbedsPropertyId})...`
  );

  const result = await subscribeWebhooksForProperty(p.id);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
