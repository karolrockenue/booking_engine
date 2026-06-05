// Mews availability read path. Cloudbeds returns availability+price together;
// Mews stores them in two native tables (mews_category_availability,
// mews_rate_prices). Here we join them — plus room_type / rate_plan metadata —
// into the same AvailabilityResultRow[] the storefront already consumes, so the
// booking flow stays PMS-agnostic.
//
// A Mews rate is service-wide, so every public rate is offered for every
// category, gated only on a per-(rate, category, night) price existing in
// mews_rate_prices and the category being sellable that night.

import { db } from "@/db";
import {
  roomTypes,
  ratePlans,
  mewsCategoryAvailability,
  mewsRatePrices,
} from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import type { AvailabilityResultRow } from "@/lib/booking/availability";
import { syncMewsInventoryForProperty } from "./sync-inventory";

// Local-calendar nights between check-in and check-out (excludes check-out day).
function nightsBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const start = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function computeMewsAvailability(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  adults: number
): Promise<AvailabilityResultRow[]> {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights.length === 0) return [];

  // Pull the window from both native tables in two range queries (checkOut day
  // is a departure, never occupied — so [checkIn, checkOut)).
  const [rooms, plans, availRows, priceRows] = await Promise.all([
    db
      .select()
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.hiddenFromBooking, false)
        )
      ),
    db
      .select()
      .from(ratePlans)
      .where(
        and(eq(ratePlans.propertyId, propertyId), eq(ratePlans.isPublic, true))
      ),
    db
      .select()
      .from(mewsCategoryAvailability)
      .where(
        and(
          eq(mewsCategoryAvailability.propertyId, propertyId),
          gte(mewsCategoryAvailability.date, checkIn),
          lt(mewsCategoryAvailability.date, checkOut)
        )
      ),
    db
      .select()
      .from(mewsRatePrices)
      .where(
        and(
          eq(mewsRatePrices.propertyId, propertyId),
          gte(mewsRatePrices.date, checkIn),
          lt(mewsRatePrices.date, checkOut)
        )
      ),
  ]);

  // Cold start: nothing cached for this window → kick a background sync (never
  // awaited; it revalidates the availability cache on completion).
  if (availRows.length === 0) {
    void syncMewsInventoryForProperty(propertyId).catch((e) => {
      console.error(
        `mews availability cold-start sync failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    });
  }

  // category(otaRoomId) + date → sellable units
  const availByCatDate = new Map<string, number>();
  for (const r of availRows) {
    availByCatDate.set(`${r.categoryId}|${r.date}`, r.unitsAvailable);
  }
  // rate + category + date → price
  const priceByRateCatDate = new Map<string, number>();
  for (const r of priceRows) {
    if (r.price != null) {
      priceByRateCatDate.set(
        `${r.rateId}|${r.categoryId}|${r.date}`,
        parseFloat(r.price)
      );
    }
  }

  const results: AvailabilityResultRow[] = [];

  for (const room of rooms) {
    if (room.maxOccupancy && adults > room.maxOccupancy) continue;
    const categoryId = room.otaRoomId;

    // Category must be sellable (>=1) every night, else no rate is bookable.
    const categoryOpen = nights.every(
      (n) => (availByCatDate.get(`${categoryId}|${n}`) ?? 0) >= 1
    );
    if (!categoryOpen) continue;

    for (const plan of plans) {
      let totalPrice = 0;
      const nightlyRates: Array<{ date: string; rate: number }> = [];
      let priced = true;

      for (const n of nights) {
        const rate = priceByRateCatDate.get(`${plan.otaRateId}|${categoryId}|${n}`);
        if (rate == null) {
          priced = false;
          break;
        }
        totalPrice += rate;
        nightlyRates.push({ date: n, rate });
      }
      if (!priced) continue;

      results.push({
        roomType: {
          id: room.id,
          otaRoomId: room.otaRoomId,
          name: room.name,
          description: room.description,
          maxOccupancy: room.maxOccupancy,
          amenities: room.amenities,
        },
        ratePlan: {
          id: plan.id,
          otaRateId: plan.otaRateId,
          name: plan.displayName ?? plan.namePublic ?? plan.name,
          isRefundable: plan.isRefundable ?? true,
        },
        totalPrice,
        nightlyRates,
        nights: nights.length,
      });
    }
  }

  return results;
}
