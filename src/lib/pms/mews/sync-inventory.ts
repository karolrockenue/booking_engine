// Mews inventory sync → our DB, in Mews's native shape.
//
// Mews splits what Cloudbeds returns together:
//   - room types      → resourceCategories/getAll      → room_types
//   - rate plans       → rates/getAll                    → rate_plans (room_type_id NULL)
//   - daily availability → services/getAvailability (legacy) → mews_category_availability
//   - daily price      → rates/getPricing                → mews_rate_prices
//
// A Mews Rate is service-wide, not category-bound (see plan §5): we store one
// rate_plans row per sellable Rate with room_type_id = NULL, and the adapter
// joins category × rate at read time via mews_rate_prices. Availability uses the
// legacy endpoint, whose `Availabilities[]` is the absolute netted sellable
// count (plan §8).

import { revalidateTag } from "next/cache";
import { db } from "@/db";
import {
  roomTypes,
  ratePlans,
  mewsCategoryAvailability,
  mewsRatePrices,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { PmsSyncResult } from "../types";
import { mews } from "./client";
import { toMewsUtc, utcToLocalDate } from "./timezone";
import { getMewsCredentials, type MewsCredentials } from "./credentials";

// --- Mews response shapes (verified against api.mews-demo.com) ---

interface MewsResourceCategory {
  Id: string;
  ServiceId: string;
  IsActive: boolean;
  Type?: string;
  Names?: Record<string, string>;
  ShortNames?: Record<string, string>;
  Descriptions?: Record<string, string>;
  Capacity?: number;
  ExtraCapacity?: number;
  Ordering?: number;
}

interface MewsRate {
  Id: string;
  ServiceId: string;
  BaseRateId: string | null;
  IsActive: boolean;
  IsEnabled: boolean;
  IsPublic: boolean;
  Type?: string;
  Name?: string;
  Names?: Record<string, string>;
  ShortName?: string;
}

interface MewsCategoryAvailability {
  CategoryId: string;
  Availabilities: number[];
  Adjustments?: number[];
}
interface MewsAvailabilityResponse {
  TimeUnitStartsUtc: string[];
  CategoryAvailabilities: MewsCategoryAvailability[];
}

interface MewsAmountPrice {
  Currency?: string;
  NetValue?: number;
  GrossValue?: number;
}
interface MewsCategoryPrice {
  CategoryId: string;
  AmountPrices: MewsAmountPrice[];
}
interface MewsPricingResponse {
  TimeUnitStartsUtc: string[];
  BaseAmountPrices: MewsAmountPrice[];
  CategoryPrices: MewsCategoryPrice[];
}

// Pick the localized name, English first, then anything, then a fallback.
function pickName(
  names: Record<string, string> | undefined,
  fallback: string
): string {
  if (!names) return fallback;
  return (
    names["en-US"] ??
    names["en-GB"] ??
    names["en"] ??
    Object.values(names)[0] ??
    fallback
  );
}

function isRefundableHeuristic(name: string | undefined): boolean {
  if (!name) return true;
  return !/non[- ]?ref/i.test(name);
}

// Postgres caps bound parameters per statement (~65k). A property with many
// categories × a long window can exceed that in one insert, so chunk rows.
function chunk<T>(rows: T[], size = 1500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

// Gross-tax enterprises bill GrossValue; net-tax bill NetValue. Never hardcode.
function priceFor(p: MewsAmountPrice | undefined, taxMode: string): number | null {
  if (!p) return null;
  const v = taxMode === "Net" ? p.NetValue : p.GrossValue;
  return typeof v === "number" ? v : null;
}

export async function syncMewsInventoryForProperty(
  propertyId: string,
  days = 90
): Promise<PmsSyncResult> {
  const start = Date.now();
  const creds = await getMewsCredentials(propertyId);
  const { accessToken, serviceId, timezone, taxMode } = creds;

  // Date window in the hotel's local calendar.
  const todayLocal = utcToLocalDate(new Date(), timezone);
  const endLocal = utcToLocalDate(
    new Date(Date.now() + days * 864e5),
    timezone
  );

  // 1. Room types ← resourceCategories/getAll (active categories of the service)
  const catResp = await mews<{ ResourceCategories?: MewsResourceCategory[] }>(
    "resourceCategories/getAll",
    accessToken,
    {
      ServiceIds: [serviceId],
      ActivityStates: ["Active"],
      Limitation: { Count: 1000 },
    }
  );
  const categories = (catResp.ResourceCategories ?? []).filter((c) => c.IsActive);

  for (const cat of categories) {
    const occ = cat.Capacity && cat.Capacity > 0 ? cat.Capacity : null;
    await db
      .insert(roomTypes)
      .values({
        propertyId,
        otaRoomId: cat.Id,
        name: pickName(cat.Names, "Room"),
        description: pickName(cat.Descriptions, "") || null,
        maxOccupancy: occ,
        baseOccupancy: occ,
      })
      .onConflictDoUpdate({
        target: [roomTypes.propertyId, roomTypes.otaRoomId],
        set: {
          name: pickName(cat.Names, "Room"),
          description: pickName(cat.Descriptions, "") || null,
          maxOccupancy: occ,
          baseOccupancy: occ,
          // hiddenFromBooking is admin-owned — never written by sync.
        },
      });
  }

  // 2. Rate plans ← rates/getAll. Sell active + enabled + public rates of the
  // service. room_type_id stays NULL: a Mews rate spans every category.
  const rateResp = await mews<{ Rates?: MewsRate[] }>("rates/getAll", accessToken, {
    ServiceIds: [serviceId],
    Extent: { Rates: true, RateGroups: true, RateRestrictions: false },
  });
  const sellableRates = (rateResp.Rates ?? []).filter(
    (r) => r.IsActive && r.IsEnabled && r.IsPublic
  );

  for (const rate of sellableRates) {
    const name = pickName(rate.Names, rate.Name ?? rate.ShortName ?? "Rate");
    await db
      .insert(ratePlans)
      .values({
        propertyId,
        roomTypeId: null,
        otaRateId: rate.Id,
        name,
        namePublic: name,
        isPublic: true,
        isRefundable: isRefundableHeuristic(name),
      })
      .onConflictDoUpdate({
        target: [ratePlans.propertyId, ratePlans.otaRateId],
        set: {
          roomTypeId: null,
          name,
          namePublic: name,
          // isRefundable / displayName / cancellationPolicy are admin-owned.
        },
      });
  }

  // 3. Availability ← legacy services/getAvailability. One call returns parallel
  // arrays for every category across the window; Availabilities[] is the
  // absolute netted sellable count (do not subtract Adjustments — plan §8).
  const avail = await mews<MewsAvailabilityResponse>(
    "services/getAvailability",
    accessToken,
    {
      ServiceId: serviceId,
      FirstTimeUnitStartUtc: toMewsUtc(todayLocal, timezone),
      LastTimeUnitStartUtc: toMewsUtc(endLocal, timezone),
    }
  );
  const availTimeUnits = avail.TimeUnitStartsUtc ?? [];
  const synced = new Set(categories.map((c) => c.Id));

  const availabilityRows = (avail.CategoryAvailabilities ?? [])
    .filter((cat) => synced.has(cat.CategoryId)) // only categories we stored
    .flatMap((cat) =>
      availTimeUnits
        .map((utc, i) => ({
          propertyId,
          categoryId: cat.CategoryId,
          date: utcToLocalDate(utc, timezone),
          unitsAvailable: cat.Availabilities?.[i] ?? 0,
        }))
        .filter((r) => r.date)
    );

  for (const batch of chunk(availabilityRows)) {
    await db
      .insert(mewsCategoryAvailability)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          mewsCategoryAvailability.propertyId,
          mewsCategoryAvailability.categoryId,
          mewsCategoryAvailability.date,
        ],
        set: {
          unitsAvailable: sql`excluded.units_available`,
          updatedAt: sql`NOW()`,
        },
      });
  }
  const availabilityRowsUpserted = availabilityRows.length;

  // 4. Price ← rates/getPricing, one call per sellable rate (well under the
  // 367-day cap for a 90-day window). CategoryPrices carries per-category daily
  // prices; categories absent from it fall back to BaseAmountPrices.
  let priceRowsUpserted = 0;
  for (const rate of sellableRates) {
    const pricing = await mews<MewsPricingResponse>(
      "rates/getPricing",
      accessToken,
      {
        RateId: rate.Id,
        FirstTimeUnitStartUtc: toMewsUtc(todayLocal, timezone),
        LastTimeUnitStartUtc: toMewsUtc(endLocal, timezone),
      }
    );
    const priceTimeUnits = pricing.TimeUnitStartsUtc ?? [];
    const byCategory = new Map(
      (pricing.CategoryPrices ?? []).map((cp) => [cp.CategoryId, cp.AmountPrices])
    );

    // All (category × day) prices for this rate, in one batched upsert.
    const rateRows = [...synced].flatMap((categoryId) => {
      const amounts = byCategory.get(categoryId) ?? pricing.BaseAmountPrices ?? [];
      return priceTimeUnits
        .map((utc, i) => {
          const price = priceFor(amounts[i], taxMode);
          return price == null
            ? null
            : {
                propertyId,
                rateId: rate.Id,
                categoryId,
                date: utcToLocalDate(utc, timezone),
                price: price.toString(),
              };
        })
        .filter((r): r is NonNullable<typeof r> => r != null && !!r.date);
    });

    for (const batch of chunk(rateRows)) {
      await db
        .insert(mewsRatePrices)
        .values(batch)
        .onConflictDoUpdate({
          target: [
            mewsRatePrices.propertyId,
            mewsRatePrices.rateId,
            mewsRatePrices.categoryId,
            mewsRatePrices.date,
          ],
          set: { price: sql`excluded.price`, updatedAt: sql`NOW()` },
        });
    }
    priceRowsUpserted += rateRows.length;
  }

  // Flush availability cache so the next storefront request recomputes fresh.
  // revalidateTag only works inside a request/render store; from a cron or CLI
  // script it throws, which must not fail the sync (the time-based revalidation
  // still catches up).
  try {
    revalidateTag(`availability:${propertyId}`, { expire: 0 });
  } catch {
    // not in a Next cache context — ignore
  }

  return {
    propertyId,
    roomTypesUpserted: categories.length,
    ratePlansUpserted: sellableRates.length,
    // Both native tables roll up into the neutral "inventory rows" counter.
    inventoryRowsUpserted: availabilityRowsUpserted + priceRowsUpserted,
    extrasUpserted: 0,
    extrasDeleted: 0,
    hotelDetailsContactUpdated: false,
    hotelDetailsNeighbourhoodUpdated: false,
    hotelDetailsGoodToKnowUpdated: false,
    hotelDetailsPropertyFieldsUpdated: [],
    rangeStart: todayLocal,
    rangeEnd: endLocal,
    durationMs: Date.now() - start,
  };
}
