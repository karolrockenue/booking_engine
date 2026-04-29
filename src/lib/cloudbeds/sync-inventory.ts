import { db } from "@/db";
import { properties, roomTypes, ratePlans, inventory } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cloudbeds } from "./client";

interface CloudbedsRoomType {
  roomTypeID: string;
  roomTypeName: string;
  roomTypeNameShort?: string;
  roomTypeDescription?: string;
  maxGuests?: number;
  adultsIncluded?: number;
  childrenIncluded?: number;
  roomTypeFeatures?: unknown;
}

interface CloudbedsDailyRate {
  date: string;
  rate: number;
  totalRate?: number;
  roomsAvailable: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minLos: number;
  maxLos: number;
  cutOff?: number;
  lastMinuteBooking?: number;
}

interface CloudbedsRatePlan {
  rateID: string;
  roomTypeID: string;
  roomTypeName: string;
  isDerived: boolean;
  // Derived-only fields
  ratePlanID?: string;
  ratePlanNamePublic?: string;
  ratePlanNamePrivate?: string;
  derivedType?: string;
  derivedValue?: number;
  baseRate?: number;
  ratePlanAddOns?: unknown[];
  // Always present
  roomRateDetailed?: CloudbedsDailyRate[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function isRefundableHeuristic(namePublic: string | undefined): boolean {
  if (!namePublic) return true;
  return !/non[- ]?ref/i.test(namePublic);
}

export interface SyncResult {
  propertyId: string;
  cloudbedsPropertyId: string;
  roomTypesUpserted: number;
  ratePlansUpserted: number;
  inventoryRowsUpserted: number;
  rangeStart: string;
  rangeEnd: string;
  durationMs: number;
}

export async function syncInventoryForProperty(
  propertyId: string,
  days = 90
): Promise<SyncResult> {
  const start = Date.now();

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) throw new Error(`Property ${propertyId} not found`);

  // Backfill cloudbedsPropertyId if it's missing (e.g. property connected
  // before the OAuth callback persisted it). Reads the first hotel exposed by
  // the token, which matches the per-property scope of our integration.
  let cloudbedsPropertyId = property.cloudbedsPropertyId;
  if (!cloudbedsPropertyId) {
    const hotels = await cloudbeds<
      ApiResponse<Array<{ propertyID: string }>>
    >(propertyId, "/getHotels");
    if (!hotels.success || !hotels.data || hotels.data.length === 0) {
      throw new Error(
        `Property ${propertyId} could not resolve a Cloudbeds property ID`
      );
    }
    cloudbedsPropertyId = hotels.data[0].propertyID;
    await db
      .update(properties)
      .set({ cloudbedsPropertyId })
      .where(eq(properties.id, propertyId));
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + days);
  const rangeStart = fmtDate(today);
  const rangeEnd = fmtDate(endDate);

  // 1. Room types
  const rtRes = await cloudbeds<ApiResponse<CloudbedsRoomType[]>>(
    propertyId,
    "/getRoomTypes",
    { query: { propertyID: cloudbedsPropertyId } }
  );
  if (!rtRes.success) {
    throw new Error(`getRoomTypes failed: ${rtRes.message ?? "unknown"}`);
  }

  const roomTypeIdMap = new Map<string, string>(); // cloudbedsRoomTypeID -> our UUID
  for (const rt of rtRes.data) {
    const baseOccupancy =
      (rt.adultsIncluded ?? 0) + (rt.childrenIncluded ?? 0) || null;

    const [row] = await db
      .insert(roomTypes)
      .values({
        propertyId,
        otaRoomId: rt.roomTypeID,
        name: rt.roomTypeName,
        description: rt.roomTypeDescription ?? null,
        maxOccupancy: rt.maxGuests ?? null,
        baseOccupancy,
        amenities: rt.roomTypeFeatures ?? null,
      })
      .onConflictDoUpdate({
        target: [roomTypes.propertyId, roomTypes.otaRoomId],
        set: {
          name: rt.roomTypeName,
          description: rt.roomTypeDescription ?? null,
          maxOccupancy: rt.maxGuests ?? null,
          baseOccupancy,
          amenities: rt.roomTypeFeatures ?? null,
        },
      })
      .returning({ id: roomTypes.id });

    if (row) roomTypeIdMap.set(rt.roomTypeID, row.id);
  }

  // 2. Rate plans + inventory
  const rpRes = await cloudbeds<ApiResponse<CloudbedsRatePlan[]>>(
    propertyId,
    "/getRatePlans",
    {
      query: {
        propertyID: cloudbedsPropertyId,
        startDate: rangeStart,
        endDate: rangeEnd,
        detailedRates: "true",
      },
    }
  );
  if (!rpRes.success) {
    throw new Error(`getRatePlans failed: ${rpRes.message ?? "unknown"}`);
  }

  let ratePlansUpserted = 0;
  let inventoryRowsUpserted = 0;

  for (const rp of rpRes.data) {
    const ourRoomTypeId = roomTypeIdMap.get(rp.roomTypeID);
    if (!ourRoomTypeId) {
      // Rate plan references a room type we didn't get (shouldn't happen if
      // both calls succeed against the same property).
      continue;
    }

    // Naming: derived rates have ratePlanNamePrivate/Public; master rates
    // (created directly on the BAR) have neither, so synthesise from the
    // room type.
    const displayName = rp.ratePlanNamePrivate
      ?? rp.ratePlanNamePublic
      ?? `${rp.roomTypeName} Standard`;
    const namePublic = rp.ratePlanNamePublic ?? null;
    const isRefundable = isRefundableHeuristic(rp.ratePlanNamePublic);

    const [planRow] = await db
      .insert(ratePlans)
      .values({
        propertyId,
        roomTypeId: ourRoomTypeId,
        otaRateId: rp.rateID,
        name: displayName,
        namePublic,
        isPublic: true,
        isRefundable,
      })
      .onConflictDoUpdate({
        target: [ratePlans.propertyId, ratePlans.otaRateId],
        set: {
          roomTypeId: ourRoomTypeId,
          name: displayName,
          namePublic,
          // Don't clobber isRefundable / cancellationPolicy on update — those
          // can be overridden in the admin UI per rate plan (Q1 resolution).
          // Only the heuristic seeds the value on first insert.
        },
      })
      .returning({ id: ratePlans.id });

    if (!planRow) continue;
    ratePlansUpserted++;

    // Inventory rows for this rate plan
    if (!rp.roomRateDetailed || rp.roomRateDetailed.length === 0) continue;

    for (const dr of rp.roomRateDetailed) {
      // Cloudbeds uses 0 to mean "no restriction"; our schema keeps min default
      // of 1 and max nullable, so translate.
      const minStay = dr.minLos > 0 ? dr.minLos : 1;
      const maxStay = dr.maxLos > 0 ? dr.maxLos : null;

      await db
        .insert(inventory)
        .values({
          propertyId,
          roomTypeId: ourRoomTypeId,
          ratePlanId: planRow.id,
          date: dr.date,
          unitsAvailable: dr.roomsAvailable,
          rate: dr.rate.toString(),
          minStay,
          maxStay,
          closedArrival: dr.closedToArrival,
          closedDeparture: dr.closedToDeparture,
        })
        .onConflictDoUpdate({
          target: [
            inventory.propertyId,
            inventory.roomTypeId,
            inventory.ratePlanId,
            inventory.date,
          ],
          set: {
            unitsAvailable: dr.roomsAvailable,
            rate: dr.rate.toString(),
            minStay,
            maxStay,
            closedArrival: dr.closedToArrival,
            closedDeparture: dr.closedToDeparture,
          },
        });
      inventoryRowsUpserted++;
    }
  }

  return {
    propertyId,
    cloudbedsPropertyId,
    roomTypesUpserted: rtRes.data.length,
    ratePlansUpserted,
    inventoryRowsUpserted,
    rangeStart,
    rangeEnd,
    durationMs: Date.now() - start,
  };
}

export async function syncInventoryForAllConnectedProperties(
  days = 90
): Promise<SyncResult[]> {
  const all = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties);

  const results: SyncResult[] = [];
  for (const p of all) {
    try {
      const res = await syncInventoryForProperty(p.id, days);
      results.push(res);
    } catch (e) {
      // Skip properties without OAuth (the function throws on missing token);
      // log and continue so one bad property doesn't kill the batch.
      const message = e instanceof Error ? e.message : String(e);
      if (!/has no cloudbedsPropertyId|has no Cloudbeds tokens/.test(message)) {
        console.error(`syncInventoryForProperty(${p.id}) failed: ${message}`);
      }
    }
  }
  return results;
}
