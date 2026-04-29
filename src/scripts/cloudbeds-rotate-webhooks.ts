// Rotate webhook subscriptions to the current webhook URL. Use after the
// endpoint URL changes (e.g. token-in-path migration): unsubscribes existing
// subs in Cloudbeds, clears our DB, then re-subscribes against the URL
// resolveEndpointUrl() now returns.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-rotate-webhooks.ts [slug]
//
// Default slug is "demo".

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  subscribeWebhooksForProperty,
  unsubscribeWebhooksForProperty,
} from "../lib/cloudbeds/webhook-subscriptions";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [p] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!p) throw new Error(`Property ${slug} not found`);

  console.log(
    `Rotating webhooks for ${p.name} (cloudbedsPropertyId=${p.cloudbedsPropertyId})...`
  );

  const unsubResult = await unsubscribeWebhooksForProperty(p.id);
  console.log("Unsubscribe:", JSON.stringify(unsubResult, null, 2));

  const subResult = await subscribeWebhooksForProperty(p.id);
  console.log("Subscribe:", JSON.stringify(subResult, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
