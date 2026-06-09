// Posts a PERSISTENT folio extra (ProductOrder) onto an EXISTING Mews reservation
// so it can be viewed in Commander. Does NOT reverse it. Cleans up only the
// throwaway DB property; the Mews order is left standing.
//
//   set -a && source .env.local && set +a \
//     MEWS_VIEW_TOKEN=<token> EXISTING_RES_ID=<reservationId> \
//     npx tsx src/scripts/mews-leave-extra.ts

import { db } from "../db";
import { properties, propertyExtras, contentBlocks } from "../db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { getMewsCredentials } from "../lib/pms/mews/credentials";
import { mews, mewsPaginated } from "../lib/pms/mews/client";
import { getPmsAdapter } from "../lib/pms";

const SLUG = "mews-leave-extra";

interface Svc { Id?: string; Type?: string }
interface Prod { Id?: string; ServiceId?: string; IsActive?: boolean; Name?: string; Price?: { GrossValue?: number; NetValue?: number } }
interface OItem { Id?: string; AccountingState?: string; Type?: string }

async function cleanup(propertyId: string) {
  await db.delete(propertyExtras).where(eq(propertyExtras.propertyId, propertyId));
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, propertyId));
  await db.delete(properties).where(eq(properties.id, propertyId));
}

async function main() {
  const token = process.env.MEWS_VIEW_TOKEN || process.env.MEWS_DEMO_ACCESS_TOKEN;
  const reservationId = process.env.EXISTING_RES_ID;
  if (!token) throw new Error("token not set");
  if (!reservationId) throw new Error("EXISTING_RES_ID not set");

  const [stale] = await db.select({ id: properties.id }).from(properties).where(eq(properties.slug, SLUG)).limit(1);
  if (stale) await cleanup(stale.id);

  const info = await fetchMewsConnectionInfo(token);

  // Find an Orderable service with an active, priced product (prefer something
  // recognisable like breakfast).
  const svcResp = await mews<{ Services?: Svc[] }>("services/getAll", token, { Limitation: { Count: 1000 } });
  const orderableIds = (svcResp.Services ?? []).filter((s) => s.Type === "Orderable" && s.Id).map((s) => s.Id as string);
  const products = await mewsPaginated<Prod>("products/getAll", token, { ServiceIds: orderableIds.slice(0, 200) }, "Products", 1000);
  const priced = products.filter((p) => p.Id && p.ServiceId && p.IsActive !== false && (p.Price?.GrossValue ?? p.Price?.NetValue ?? 0) > 0);
  const product =
    priced.find((p) => /breakfast/i.test(p.Name ?? "")) ??
    priced.find((p) => /(dinner|parking|wine|spa|late|transfer|bottle)/i.test(p.Name ?? "")) ??
    priced[0];
  if (!product?.ServiceId) throw new Error("No active priced product found");

  const [property] = await db.insert(properties).values({
    slug: SLUG, name: "Mews Leave Extra", theme: {}, pmsType: "mews",
    timezone: info.timezone || "Europe/London", currency: info.currency || "GBP",
    pmsCredentials: {
      accessTokenEnc: encryptToken(token), serviceId: info.services[0]?.id, timezone: info.timezone,
      enterpriseId: info.enterpriseId, taxMode: info.taxMode,
      externalPaymentType: info.externalPaymentTypes[0] ?? "Cash", currency: info.currency,
      extrasServiceIds: [product.ServiceId],
    },
  }).returning();
  const propertyId = property.id;
  const adapter = getPmsAdapter(property);
  const creds = await getMewsCredentials(propertyId);

  try {
    await adapter.syncExtras();
    const [synced] = await db.select().from(propertyExtras)
      .where(eq(propertyExtras.propertyId, propertyId));
    const row = synced ?? null;
    const target = row && row.otaExtraId === product.Id ? row :
      (await db.select().from(propertyExtras).where(eq(propertyExtras.propertyId, propertyId)))
        .find((r) => r.otaExtraId === product.Id);
    if (!target) throw new Error("product not synced into property_extras");

    const { pmsItemId: orderId } = await adapter.postExtra({
      reservationId,
      name: target.name,
      amount: target.priceMinorUnits / 100,
      quantity: 1,
      otaExtraId: target.otaExtraId,
      pmsServiceId: target.pmsServiceId ?? undefined,
    });

    // confirm the line appears (read-after-write lag)
    let items: OItem[] = [];
    for (let i = 0; i < 8 && orderId; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      items = await mewsPaginated<OItem>("orderItems/getAll", creds.accessToken, { ServiceOrderIds: [orderId] }, "OrderItems", 1000);
      if (items.length > 0) break;
    }
    const active = items.filter((i) => i.AccountingState !== "Canceled" && i.AccountingState !== "Inactive");

    console.log("\n========= EXTRA LEFT STANDING ON THE FOLIO =========");
    console.log(`Reservation:   ${reservationId}`);
    console.log(`Product:       ${target.name}`);
    console.log(`Price:         ${target.priceMinorUnits / 100} ${info.currency} × 1`);
    console.log(`Order Id:      ${orderId}`);
    console.log(`Folio lines:   ${active.length} active (${items.map((i) => i.Type).join(", ") || "lagged"})`);
    console.log("====================================================");
    console.log("In Commander: open the reservation → Billing/Bill — the");
    console.log(`product line "${target.name}" is now on the folio.`);
  } finally {
    console.log("\nRemoving throwaway DB property (Mews order stays)...");
    await cleanup(propertyId);
    console.log("Done.");
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
