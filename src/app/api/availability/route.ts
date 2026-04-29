import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, inventory, roomTypes, ratePlans } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { syncInventoryForProperty } from "@/lib/cloudbeds/sync-inventory";

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

  // Cold-start: if the property is connected to Cloudbeds but we have no
  // inventory rows in the requested window, sync synchronously. This catches
  // the first ever request after OAuth and any gap left by a missed webhook
  // before the 6-hourly safety net runs.
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
    try {
      await syncInventoryForProperty(propertyId);
    } catch (e) {
      console.error(
        `availability cold-start sync failed: ${e instanceof Error ? e.message : String(e)}`
      );
      // Fall through — return whatever (empty) inventory we have rather than 500.
    }
  }

  // Get all room types for the property
  const rooms = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.propertyId, propertyId));

  const results = [];

  for (const room of rooms) {
    // Filter by occupancy
    if (room.maxOccupancy && adults > room.maxOccupancy) continue;

    // Get public rate plans for this room
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
      // Get inventory for all nights of the stay
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

      // We need inventory for every night (checkIn to checkOut - 1 day)
      // Build a map of date -> inventory row
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

        // Check arrival restriction on first night
        if (i === 0 && dayInv.closedArrival) {
          available = false;
          break;
        }

        // Check min/max stay
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

      // Check departure restriction on checkout date
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
            name: plan.namePublic ?? plan.name,
          },
          totalPrice,
          nightlyRates,
          nights,
        });
      }
    }
  }

  return NextResponse.json({ results });
}
