// Pulls the connected hotel's name from Cloudbeds and writes it into our
// properties row. One-shot — does not auto-run on sync, so admin edits to
// properties.name aren't overwritten silently.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-update-name.ts [slug] [flags]
//
// Defaults: slug "demo", name only.
//
// Flags:
//   --with-currency   also sync currency from Cloudbeds (CB partner sandbox
//                     returns USD even when the property charges in GBP — only
//                     pass this when connecting a real hotel)
//   --with-timezone   also sync timezone from Cloudbeds

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { cloudbeds } from "../lib/cloudbeds/client";

interface HotelDetails {
  propertyID?: string;
  propertyName?: string;
  propertyCurrency?: { currencyCode?: string; currencySymbol?: string };
  propertyTimezone?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.filter((a) => !a.startsWith("--"));
  const slug = positional[0] ?? "demo";
  const withCurrency = flags.has("--with-currency");
  const withTimezone = flags.has("--with-timezone");

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (!property) {
    console.error(`Property "${slug}" not found in DB.`);
    process.exit(1);
  }

  if (!property.cloudbedsAccessToken) {
    console.error(`Property "${slug}" has no Cloudbeds connection.`);
    process.exit(1);
  }

  let cloudbedsPropertyId = property.cloudbedsPropertyId;
  if (!cloudbedsPropertyId) {
    const hotels = await cloudbeds<ApiResponse<Array<{ propertyID: string }>>>(
      property.id,
      "/getHotels"
    );
    if (!hotels.success || !hotels.data?.length) {
      console.error("Could not resolve Cloudbeds property ID.");
      process.exit(1);
    }
    cloudbedsPropertyId = hotels.data[0].propertyID;
  }

  const detailsRes = await cloudbeds<ApiResponse<HotelDetails>>(
    property.id,
    "/getHotelDetails",
    { query: { propertyID: cloudbedsPropertyId } }
  );

  if (!detailsRes.success) {
    console.error(`getHotelDetails failed: ${detailsRes.message ?? "unknown"}`);
    process.exit(1);
  }

  const cbName = detailsRes.data.propertyName?.trim();
  const cbCurrency = detailsRes.data.propertyCurrency?.currencyCode?.trim();
  const cbTimezone = detailsRes.data.propertyTimezone?.trim();

  if (!cbName) {
    console.error("Cloudbeds returned no propertyName. Aborting.");
    process.exit(1);
  }

  const update: Partial<typeof properties.$inferInsert> = {};
  const changes: string[] = [];

  if (property.name !== cbName) {
    update.name = cbName;
    changes.push(`  name:     "${property.name}" → "${cbName}"`);
  }
  if (withCurrency && cbCurrency && property.currency !== cbCurrency) {
    update.currency = cbCurrency;
    changes.push(`  currency: "${property.currency}" → "${cbCurrency}"`);
  }
  if (withTimezone && cbTimezone && property.timezone !== cbTimezone) {
    update.timezone = cbTimezone;
    changes.push(`  timezone: "${property.timezone}" → "${cbTimezone}"`);
  }

  console.log(`Cloudbeds property #${cloudbedsPropertyId}:`);
  console.log(`  cb propertyName: "${cbName}"`);
  if (cbCurrency) console.log(`  cb currency:     "${cbCurrency}"${withCurrency ? "" : "  (skipped — pass --with-currency)"}`);
  if (cbTimezone) console.log(`  cb timezone:     "${cbTimezone}"${withTimezone ? "" : "  (skipped — pass --with-timezone)"}`);

  if (changes.length === 0) {
    console.log(`\nNo changes — DB already matches.`);
    return;
  }

  console.log("\nApplying:");
  changes.forEach((c) => console.log(c));
  await db.update(properties).set(update).where(eq(properties.id, property.id));
  console.log("\n✓ Updated.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
