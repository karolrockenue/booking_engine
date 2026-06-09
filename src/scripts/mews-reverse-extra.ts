// Reverses a folio extra (orderItems/cancel) on an existing Mews reservation,
// via the real adapter — exactly what the cancel route does. Cleans up the
// throwaway DB property; the Mews order line is left Canceled.
//
//   set -a && source .env.local && set +a \
//     MEWS_VIEW_TOKEN=<token> EXISTING_RES_ID=<resId> ORDER_ID=<orderId> \
//     npx tsx src/scripts/mews-reverse-extra.ts

import { db } from "../db";
import { properties, contentBlocks } from "../db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { getMewsCredentials } from "../lib/pms/mews/credentials";
import { mewsPaginated } from "../lib/pms/mews/client";
import { getPmsAdapter } from "../lib/pms";

const SLUG = "mews-reverse-extra";
interface OItem { Id?: string; AccountingState?: string }

async function cleanup(id: string) {
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, id));
  await db.delete(properties).where(eq(properties.id, id));
}

async function main() {
  const token = process.env.MEWS_VIEW_TOKEN || process.env.MEWS_DEMO_ACCESS_TOKEN;
  const reservationId = process.env.EXISTING_RES_ID;
  const orderId = process.env.ORDER_ID;
  if (!token || !reservationId || !orderId) throw new Error("token / EXISTING_RES_ID / ORDER_ID required");

  const [stale] = await db.select({ id: properties.id }).from(properties).where(eq(properties.slug, SLUG)).limit(1);
  if (stale) await cleanup(stale.id);

  const info = await fetchMewsConnectionInfo(token);
  const [property] = await db.insert(properties).values({
    slug: SLUG, name: "Mews Reverse Extra", theme: {}, pmsType: "mews",
    timezone: info.timezone || "Europe/London", currency: info.currency || "GBP",
    pmsCredentials: {
      accessTokenEnc: encryptToken(token), serviceId: info.services[0]?.id, timezone: info.timezone,
      enterpriseId: info.enterpriseId, taxMode: info.taxMode,
      externalPaymentType: info.externalPaymentTypes[0] ?? "Cash", currency: info.currency,
    },
  }).returning();
  const propertyId = property.id;
  const adapter = getPmsAdapter(property);
  const creds = await getMewsCredentials(propertyId);

  try {
    await adapter.reverseExtra({ reservationId, pmsItemId: orderId, name: "extra", unitPrice: 0, quantity: 1 });
    let active = 1;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const items = await mewsPaginated<OItem>("orderItems/getAll", creds.accessToken, { ServiceOrderIds: [orderId] }, "OrderItems", 1000);
      active = items.filter((x) => x.AccountingState !== "Canceled" && x.AccountingState !== "Inactive").length;
      if (active === 0) break;
    }
    console.log(active === 0 ? `\n✓ Order ${orderId} fully cancelled on the folio.` : `\n⚠ ${active} line(s) still active.`);
  } finally {
    await cleanup(propertyId);
    console.log("Cleaned up throwaway property.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
