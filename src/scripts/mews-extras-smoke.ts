// Folio-extras end-to-end through the REAL adapter: syncExtras (products/getAll
// → property_extras) → postExtra (orders/add ProductOrder, as the booking route
// calls it) → reverseExtra (orderItems/cancel, as the cancel route calls it).
// Discovers a live demo product, verifies each step, self-cleaning.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-extras-smoke.ts

import { db } from "../db";
import {
  properties,
  roomTypes,
  ratePlans,
  propertyExtras,
  mewsCategoryAvailability,
  mewsRatePrices,
  contentBlocks,
} from "../db/schema";
import { and, eq } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { getMewsCredentials } from "../lib/pms/mews/credentials";
import { mews, mewsPaginated } from "../lib/pms/mews/client";
import { getPmsAdapter } from "../lib/pms";

const SLUG = "mews-extras-smoke";

async function cleanup(propertyId: string) {
  await db.delete(propertyExtras).where(eq(propertyExtras.propertyId, propertyId));
  await db.delete(mewsRatePrices).where(eq(mewsRatePrices.propertyId, propertyId));
  await db.delete(mewsCategoryAvailability).where(eq(mewsCategoryAvailability.propertyId, propertyId));
  await db.delete(ratePlans).where(eq(ratePlans.propertyId, propertyId));
  await db.delete(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, propertyId));
  await db.delete(properties).where(eq(properties.id, propertyId));
}

interface Svc { Id?: string; Type?: string }
interface Prod { Id?: string; ServiceId?: string; IsActive?: boolean; Price?: { GrossValue?: number; NetValue?: number } }
interface OItem { Id?: string; AccountingState?: string; Type?: string; ServiceOrderId?: string }

async function main() {
  const token = process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  const [stale] = await db.select({ id: properties.id }).from(properties).where(eq(properties.slug, SLUG)).limit(1);
  if (stale) await cleanup(stale.id);

  const info = await fetchMewsConnectionInfo(token);
  const service = info.services.find((s) => s.name === "Accommodation (real)") ?? info.services[0];
  if (!service) throw new Error("No Reservable service");

  // Discover an Orderable service with at least one active, priced product.
  const svcResp = await mews<{ Services?: Svc[] }>("services/getAll", token, { Limitation: { Count: 1000 } });
  const orderableIds = (svcResp.Services ?? []).filter((s) => s.Type === "Orderable" && s.Id).map((s) => s.Id as string);
  const products = await mewsPaginated<Prod>("products/getAll", token, { ServiceIds: orderableIds.slice(0, 200) }, "Products", 1000);
  const product = products.find((p) => p.Id && p.ServiceId && p.IsActive !== false && (p.Price?.GrossValue ?? p.Price?.NetValue ?? 0) > 0);
  if (!product?.ServiceId) throw new Error("No active priced product found on demo Orderable services");
  console.log(`Using product ${product.Id} on service ${product.ServiceId} (price ${product.Price?.GrossValue ?? product.Price?.NetValue})`);

  const [property] = await db.insert(properties).values({
    slug: SLUG, name: "Mews Extras Smoke", theme: {}, pmsType: "mews",
    timezone: info.timezone || "Europe/London", currency: info.currency || "GBP",
    pmsCredentials: {
      accessTokenEnc: encryptToken(token), serviceId: service.id, timezone: info.timezone,
      enterpriseId: info.enterpriseId, taxMode: info.taxMode,
      externalPaymentType: info.externalPaymentTypes[0] ?? "Cash", currency: info.currency,
      extrasServiceIds: [product.ServiceId], // the piece the admin UI will set
    },
  }).returning();
  const propertyId = property.id;
  const adapter = getPmsAdapter(property);
  const creds = await getMewsCredentials(propertyId);
  let reservationId: string | undefined;
  let pass = true;
  const fail = (m: string) => { pass = false; console.log(`❌ ${m}`); };

  try {
    // C — syncExtras
    await adapter.syncExtras();
    const extraRows = await db.select().from(propertyExtras).where(eq(propertyExtras.propertyId, propertyId));
    const synced = extraRows.find((r) => r.otaExtraId === product.Id);
    if (!synced) fail("syncExtras did not create the product row");
    else if (synced.pmsServiceId !== product.ServiceId) fail("synced row missing pms_service_id");
    else console.log(`✓ syncExtras → ${extraRows.length} rows; product row has ota_extra_id + pms_service_id`);
    if (!synced) throw new Error("cannot continue without synced extra");

    // booking prerequisites
    await adapter.syncInventory(30);
    const ci = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const co = new Date(Date.now() + 23 * 864e5).toISOString().slice(0, 10);
    const opt = (await adapter.getAvailability(ci, co, 2)).find((o) => o.totalPrice > 0);
    if (!opt) throw new Error("No bookable option");
    const created = await adapter.createReservation({
      startDate: ci, endDate: co, guestFirstName: "Extras", guestLastName: "Smoke",
      guestEmail: `extrassmoke+${Date.now()}@example.com`, guestCountry: "GB",
      roomTypeId: opt.roomType.otaRoomId, rateId: opt.ratePlan.otaRateId,
      adults: 2, children: 0, roomSubtotal: opt.totalPrice,
      orderId: `extrassmoke-${Date.now()}`, nightlyRates: opt.nightlyRates,
    });
    reservationId = created.pmsReservationId;
    console.log(`✓ reservation ${reservationId}`);

    // E — postExtra exactly as the booking route does (with otaExtraId + pmsServiceId)
    const { pmsItemId: orderId } = await adapter.postExtra({
      reservationId, name: synced.name, amount: synced.priceMinorUnits / 100, quantity: 2,
      otaExtraId: synced.otaExtraId, pmsServiceId: synced.pmsServiceId ?? undefined,
    });
    if (!orderId) fail("postExtra returned no OrderId");
    else console.log(`✓ postExtra → OrderId ${orderId}`);

    // verify the order's items appear (read-after-write lag)
    let items: OItem[] = [];
    for (let i = 0; i < 12 && orderId; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      items = await mewsPaginated<OItem>("orderItems/getAll", creds.accessToken, { ServiceOrderIds: [orderId] }, "OrderItems", 1000);
      if (items.length > 0) break;
      console.log(`  …waiting for order items (count ${items.length})`);
    }
    const active = items.filter((i) => i.AccountingState !== "Canceled" && i.AccountingState !== "Inactive");
    if (active.length === 0) fail("no active order items found after postExtra");
    else console.log(`✓ order has ${active.length} active item(s) (${items.map((i) => i.Type).join(", ")})`);

    // G — reverseExtra exactly as the cancel route does
    await adapter.reverseExtra({
      reservationId, pmsItemId: orderId, name: synced.name,
      unitPrice: synced.priceMinorUnits / 100, quantity: 2,
    });
    console.log("✓ reverseExtra called");

    // verify items are now cancelled
    let afterActive = active.length;
    for (let i = 0; i < 12 && orderId; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const after = await mewsPaginated<OItem>("orderItems/getAll", creds.accessToken, { ServiceOrderIds: [orderId] }, "OrderItems", 1000);
      afterActive = after.filter((i) => i.AccountingState !== "Canceled" && i.AccountingState !== "Inactive").length;
      if (afterActive === 0) break;
      console.log(`  …waiting for cancellation (active ${afterActive})`);
    }
    if (afterActive === 0) console.log("✓ all order items cancelled — extra reversed");
    else fail(`${afterActive} order items still active after reverseExtra`);

    console.log(pass ? "\n✅ PASS — Mews extras sync + post + reverse verified." : "\n❌ FAIL");
  } finally {
    if (reservationId) { try { await adapter.cancelReservation({ reservationId, reason: "extras smoke cleanup" }); } catch { /* noop */ } }
    await cleanup(propertyId);
    console.log("Cleaned up throwaway property.");
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error("\nSMOKE CRASHED:", e instanceof Error ? e.message : e); process.exit(1); });
