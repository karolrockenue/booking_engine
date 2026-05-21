import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { properties, inventory, roomTypes, ratePlans } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { syncInventoryForProperty } from "@/lib/cloudbeds/sync-inventory";

interface AvailabilityResultRow {
  roomType: {
    id: string;
    otaRoomId: string;
    name: string;
    description: string | null;
    maxOccupancy: number | null;
    amenities: unknown;
  };
  ratePlan: {
    id: string;
    otaRateId: string;
    name: string;
    isRefundable: boolean;
  };
  totalPrice: number;
  nightlyRates: Array<{ date: string; rate: number }>;
  nights: number;
}

// Pure compute: queries the DB and returns the availability tree. Wrapped
// below by unstable_cache. If the property is OAuth'd to Cloudbeds but has
// no inventory in the requested window, fires a fire-and-forget background
// sync — the sync calls revalidateTag at the end, so the next request after
// it completes will recompute against fresh data instead of waiting on
// in-band sync (which used to add ~3s to the first request of the day).
async function computeAvailability(
  propertyId: string,
  checkIn: string,
  checkOut: string,
  adults: number
): Promise<AvailabilityResultRow[]> {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  const [coldStartCheck] = await db
    .select({
      cloudbedsPropertyId: properties.cloudbedsPropertyId,
      hasInventory: sql<boolean>`EXISTS (
        SELECT 1 FROM ${inventory}
        WHERE ${inventory.propertyId} = ${properties.id}
          AND ${inventory.date} >= ${checkIn}
          AND ${inventory.date} <= ${checkOut}
      )`,
    })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (coldStartCheck?.cloudbedsPropertyId && !coldStartCheck.hasInventory) {
    // Background sync — never await. The sync calls revalidateTag on
    // completion which will flush this cache entry.
    void syncInventoryForProperty(propertyId).catch((e) => {
      console.error(
        `availability cold-start background sync failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    });
  }

  const rooms = await db
    .select()
    .from(roomTypes)
    .where(
      and(
        eq(roomTypes.propertyId, propertyId),
        // Admin can hide room types (e.g. virtual/staff rooms) from the
        // booking engine; never surface them in availability.
        eq(roomTypes.hiddenFromBooking, false)
      )
    );

  const results: AvailabilityResultRow[] = [];

  for (const room of rooms) {
    if (room.maxOccupancy && adults > room.maxOccupancy) continue;

    const plans = await db
      .select()
      .from(ratePlans)
      .where(
        and(
          eq(ratePlans.roomTypeId, room.id),
          eq(ratePlans.isPublic, true)
        )
      );

    for (const plan of plans) {
      const inv = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.propertyId, propertyId),
            eq(inventory.roomTypeId, room.id),
            eq(inventory.ratePlanId, plan.id),
            gte(inventory.date, checkIn),
            lte(inventory.date, checkOut)
          )
        );

      const invByDate = new Map(inv.map((i) => [i.date, i]));

      let available = true;
      let totalPrice = 0;
      const nightlyRates: Array<{ date: string; rate: number }> = [];

      for (let i = 0; i < nights; i++) {
        const d = new Date(checkInDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const dayInv = invByDate.get(dateStr);

        if (!dayInv || dayInv.unitsAvailable < 1 || !dayInv.rate) {
          available = false;
          break;
        }

        if (i === 0 && dayInv.closedArrival) {
          available = false;
          break;
        }

        if (dayInv.minStay && nights < dayInv.minStay) {
          available = false;
          break;
        }
        if (dayInv.maxStay && nights > dayInv.maxStay) {
          available = false;
          break;
        }

        const rate = parseFloat(dayInv.rate);
        totalPrice += rate;
        nightlyRates.push({ date: dateStr, rate });
      }

      if (available) {
        const checkOutInv = invByDate.get(checkOut);
        if (checkOutInv?.closedDeparture) {
          available = false;
        }
      }

      if (available) {
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
            // Admin override wins; otherwise the Cloudbeds name.
            name: plan.displayName ?? plan.namePublic ?? plan.name,
            isRefundable: plan.isRefundable ?? true,
          },
          totalPrice,
          nightlyRates,
          nights,
        });
      }
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const checkIn = searchParams.get("checkIn");
  const checkOut = searchParams.get("checkOut");
  const adults = parseInt(searchParams.get("adults") ?? "1");

  if (!propertyId || !checkIn || !checkOut) {
    return NextResponse.json(
      { error: "Missing propertyId, checkIn, or checkOut" },
      { status: 400 }
    );
  }

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  if (nights < 1) {
    return NextResponse.json(
      { error: "checkOut must be after checkIn" },
      { status: 400 }
    );
  }

  // Per-property cache tag so syncInventoryForProperty(propId) only flushes
  // entries for that property. revalidate=30 caps staleness if a sync
  // somehow misses (e.g. a bug skips revalidateTag).
  const cached = unstable_cache(
    () => computeAvailability(propertyId, checkIn, checkOut, adults),
    ["availability", propertyId, checkIn, checkOut, String(adults)],
    {
      revalidate: 30,
      tags: [`availability:${propertyId}`],
    }
  );

  const results = await cached();
  return NextResponse.json({ results });
}
