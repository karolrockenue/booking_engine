// Mews extras (products) sync → property_extras, in our neutral shape.
//
// Mews extras are PRODUCTS that live on Orderable services (POS/F&B/etc.), not
// the accommodation service. A Mews enterprise exposes many Orderable services,
// so the admin picks which ones feed the booking engine (creds.extrasServiceIds);
// we only sync products from those. Each product → one property_extras row with
//   ota_extra_id   = Mews ProductId   (the id we order with)
//   pms_service_id = product.ServiceId (required by orders/add)
// Price is the gross (guest-facing) amount so it matches what Stripe charges and
// what ProductOrders posts to the folio. pricingModel is admin-set and preserved
// on re-sync (we only seed a sensible default from ChargingMode on first insert).

import { db } from "@/db";
import { propertyExtras } from "@/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { mewsPaginated } from "./client";
import { getMewsCredentials, type MewsCredentials } from "./credentials";

interface MewsProduct {
  Id?: string;
  ServiceId?: string;
  IsActive?: boolean;
  Names?: Record<string, string>;
  ExternalNames?: Record<string, string>;
  Descriptions?: Record<string, string>;
  ChargingMode?: string; // Once | PerTimeUnit | PerPerson | PerPersonPerTimeUnit
  Price?: { Currency?: string; GrossValue?: number; NetValue?: number };
}

const localized = (n?: Record<string, string>): string | undefined =>
  n?.en ?? (n ? Object.values(n)[0] : undefined);

// Map Mews ChargingMode → our pricingModel default. Per-person-per-time-unit is
// our "per_guest_per_night" (breakfast); everything else seeds as per_stay. Only
// applied on first insert — admin overrides are preserved on re-sync.
function defaultPricingModel(chargingMode?: string): "per_stay" | "per_guest_per_night" {
  return chargingMode === "PerPersonPerTimeUnit" ? "per_guest_per_night" : "per_stay";
}

export interface MewsExtrasSyncResult {
  propertyId: string;
  extrasUpserted: number;
  extrasDeleted: number;
}

export async function syncMewsExtrasForProperty(
  propertyId: string,
  credsArg?: MewsCredentials
): Promise<MewsExtrasSyncResult> {
  const creds = credsArg ?? (await getMewsCredentials(propertyId));

  // No extras services chosen → nothing to sell. Clear any stale Mews rows so a
  // de-selected service's products disappear, and return.
  if (creds.extrasServiceIds.length === 0) {
    const cleared = await db
      .delete(propertyExtras)
      .where(
        and(
          eq(propertyExtras.propertyId, propertyId),
          sql`${propertyExtras.cloudbedsAddonId} IS NULL`
        )
      )
      .returning({ id: propertyExtras.id });
    console.log(
      `[Mews] syncExtras: no extrasServiceIds for ${propertyId} — cleared ${cleared.length} stale rows`
    );
    return { propertyId, extrasUpserted: 0, extrasDeleted: cleared.length };
  }

  const products = await mewsPaginated<MewsProduct>(
    "products/getAll",
    creds.accessToken,
    { ServiceIds: creds.extrasServiceIds },
    "Products",
    1000
  );

  let upserted = 0;
  const liveIds: string[] = [];
  for (const p of products) {
    if (!p.Id || !p.ServiceId || p.IsActive === false) continue;
    // Guest-facing gross price (tax-inclusive) — matches Stripe + the posted
    // ProductOrder. Skip products without a usable price.
    const gross = p.Price?.GrossValue ?? p.Price?.NetValue;
    if (gross == null) continue;
    const priceMinorUnits = Math.round(gross * 100);
    const name = localized(p.ExternalNames) ?? localized(p.Names) ?? "Extra";

    liveIds.push(p.Id);
    await db
      .insert(propertyExtras)
      .values({
        propertyId,
        otaExtraId: p.Id,
        pmsServiceId: p.ServiceId,
        cloudbedsAddonId: null,
        name,
        description: localized(p.Descriptions) ?? null,
        priceMinorUnits,
        currency: p.Price?.Currency ?? creds.currency,
        pricingModel: defaultPricingModel(p.ChargingMode),
      })
      .onConflictDoUpdate({
        target: [propertyExtras.propertyId, propertyExtras.otaExtraId],
        set: {
          pmsServiceId: p.ServiceId,
          name,
          description: localized(p.Descriptions) ?? null,
          priceMinorUnits,
          currency: p.Price?.Currency ?? creds.currency,
          // pricingModel deliberately NOT updated — preserve admin override.
          lastSyncedAt: sql`NOW()`,
        },
      });
    upserted++;
  }

  // Delete Mews rows (cloudbeds_addon_id IS NULL) whose product no longer syncs.
  const deleted = await db
    .delete(propertyExtras)
    .where(
      and(
        eq(propertyExtras.propertyId, propertyId),
        sql`${propertyExtras.cloudbedsAddonId} IS NULL`,
        liveIds.length > 0
          ? notInArray(propertyExtras.otaExtraId, liveIds)
          : sql`TRUE`
      )
    )
    .returning({ id: propertyExtras.id });

  return { propertyId, extrasUpserted: upserted, extrasDeleted: deleted.length };
}
