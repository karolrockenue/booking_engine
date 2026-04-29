import { db } from "@/db";
import { properties, propertyExtras } from "@/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { getValidAccessToken } from "./client";

// The addons API lives on a different host (api.cloudbeds.com) than the v1.3
// PMS endpoints used by the `cloudbeds()` helper. Property scoping is via the
// `x-property-id` header, not a query param.
const ADDONS_BASE = "https://api.cloudbeds.com/addons/v1/addons";
const PAGE_LIMIT = 100;

interface CloudbedsAddon {
  id: string;
  name: string;
  description?: string | null;
  productId?: string;
  price?: {
    amount?: string;
    currencyCode?: string;
  };
}

interface AddonsResponse {
  offset: number;
  limit: number;
  data: CloudbedsAddon[];
}

export interface SyncExtrasResult {
  propertyId: string;
  cloudbedsPropertyId: string;
  upserted: number;
  deleted: number;
  durationMs: number;
}

async function fetchAddonsPage(
  token: string,
  cloudbedsPropertyId: string,
  offset: number
): Promise<AddonsResponse> {
  const url = new URL(ADDONS_BASE);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(PAGE_LIMIT));

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "x-property-id": cloudbedsPropertyId,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Cloudbeds /addons/v1/addons failed: ${res.status} ${text}`
    );
  }

  return (await res.json()) as AddonsResponse;
}

export async function syncExtrasForProperty(
  propertyId: string
): Promise<SyncExtrasResult> {
  const start = Date.now();

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) throw new Error(`Property ${propertyId} not found`);
  if (!property.cloudbedsPropertyId) {
    throw new Error(
      `Property ${propertyId} has no cloudbedsPropertyId — connect via OAuth first`
    );
  }

  const token = await getValidAccessToken(propertyId);

  const collected: CloudbedsAddon[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchAddonsPage(
      token,
      property.cloudbedsPropertyId,
      offset
    );
    collected.push(...page.data);
    if (page.data.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
  }

  // Upsert each addon. The currency on the addon is unreliable on test
  // accounts; per the spec we trust it for catalog display but the booking
  // flow uses the property currency. Fall back to the property currency when
  // the addon doesn't carry one.
  const fallbackCurrency = property.currency ?? "GBP";
  let upserted = 0;
  for (const addon of collected) {
    const amountStr = addon.price?.amount;
    if (!amountStr) continue;
    const priceMinorUnits = parseInt(amountStr, 10);
    if (Number.isNaN(priceMinorUnits)) continue;

    await db
      .insert(propertyExtras)
      .values({
        propertyId,
        cloudbedsAddonId: addon.id,
        cloudbedsProductId: addon.productId ?? null,
        name: addon.name,
        description: addon.description ?? null,
        priceMinorUnits,
        currency: addon.price?.currencyCode ?? fallbackCurrency,
      })
      .onConflictDoUpdate({
        target: [propertyExtras.propertyId, propertyExtras.cloudbedsAddonId],
        set: {
          cloudbedsProductId: addon.productId ?? null,
          name: addon.name,
          description: addon.description ?? null,
          priceMinorUnits,
          currency: addon.price?.currencyCode ?? fallbackCurrency,
          lastSyncedAt: sql`NOW()`,
        },
      });
    upserted++;
  }

  // Hard-delete rows whose addon no longer appears in Cloudbeds, so removed
  // catalog items disappear from the booking flow.
  const liveIds = collected.map((a) => a.id);
  const deletedRows = liveIds.length
    ? await db
        .delete(propertyExtras)
        .where(
          and(
            eq(propertyExtras.propertyId, propertyId),
            notInArray(propertyExtras.cloudbedsAddonId, liveIds)
          )
        )
        .returning({ id: propertyExtras.id })
    : await db
        .delete(propertyExtras)
        .where(eq(propertyExtras.propertyId, propertyId))
        .returning({ id: propertyExtras.id });

  return {
    propertyId,
    cloudbedsPropertyId: property.cloudbedsPropertyId,
    upserted,
    deleted: deletedRows.length,
    durationMs: Date.now() - start,
  };
}
