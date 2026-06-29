// Shared booking-preparation: the server-side validation + pricing that BOTH
// the create-before-pay init (POST /api/bookings/init) and the finalise path
// (POST /api/bookings) must run identically. Extracted so the two entry points
// can never drift on availability rules, the price split, the cancellation
// snapshot, chargeAt, or how the extras intent is built.
//
// It does NOT touch Stripe and does NOT write to the DB — it loads the
// property/room/rate, re-checks availability (PMS-aware), computes the money
// breakdown, and returns ready-to-insert values. Callers do the inserts.

import { db } from "@/db";
import {
  bookingExtras,
  inventory,
  properties,
  propertyExtras,
  ratePlans,
  roomTypes,
} from "@/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  extraLineTotal,
  isPricingModel,
  stayMornings,
} from "@/lib/booking/extra-pricing";
import type { ExtraConfig, PricingModel } from "@/lib/booking/types";
import { getPmsAdapter } from "@/lib/pms";

export interface PrepareExtraInput {
  id: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
  config?: { guests: number; mornings: string[] };
}

export interface PrepareBookingInput {
  propertyId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  totalPrice: number; // room + extras, major units (client computed, re-derived here)
  currency?: string;
  extras?: PrepareExtraInput[];
}

export interface PreparedBooking {
  property: typeof properties.$inferSelect;
  room: typeof roomTypes.$inferSelect;
  ratePlan: typeof ratePlans.$inferSelect;
  rateType: "flex" | "nr";
  nights: number;
  // money — strings, 2dp, ready for the decimal columns
  roomTotal: string;
  extrasTotal: string;
  grandTotal: string;
  applicationFee: string;
  currency: string;
  cancellationPolicySnapshot: unknown;
  chargeAt: Date | null;
  // one row per selected extra, sans bookingId (caller fills it after insert)
  extraIntentRows: Omit<typeof bookingExtras.$inferInsert, "bookingId">[];
}

// Typed error so routes can map to the right HTTP status without sniffing
// strings. `code` mirrors the storefront-facing codes (e.g. room_sold_out).
export class PrepareBookingError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PrepareBookingError";
    this.status = status;
    this.code = code;
  }
}

export async function prepareBooking(
  input: PrepareBookingInput
): Promise<PreparedBooking> {
  if (
    !input.propertyId ||
    !input.roomTypeId ||
    !input.ratePlanId ||
    !input.checkIn ||
    !input.checkOut ||
    input.totalPrice === undefined
  ) {
    throw new PrepareBookingError("Missing required fields", 400);
  }

  const checkInDate = new Date(input.checkIn);
  const checkOutDate = new Date(input.checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, input.propertyId))
    .limit(1);
  if (!property) {
    throw new PrepareBookingError("Property not found", 404);
  }

  // Final availability re-check, PMS-aware. Cloudbeds keeps its direct
  // inventory-table check; Mews stores availability in its own native tables,
  // so we re-check through the adapter and confirm the chosen room+rate is
  // still offered for the dates.
  if (property.pmsType === "mews") {
    const avail = await getPmsAdapter(property).getAvailability(
      input.checkIn,
      input.checkOut,
      input.adults ?? 1
    );
    const stillAvailable = avail.some(
      (r) =>
        r.roomType.id === input.roomTypeId && r.ratePlan.id === input.ratePlanId
    );
    if (!stillAvailable) {
      throw new PrepareBookingError(
        "Room is no longer available for these dates",
        409,
        "room_sold_out"
      );
    }
  } else {
    if (!property.cloudbedsPropertyId) {
      throw new PrepareBookingError(
        "Property is not connected to Cloudbeds",
        409
      );
    }
    const inv = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.propertyId, input.propertyId),
          eq(inventory.roomTypeId, input.roomTypeId),
          eq(inventory.ratePlanId, input.ratePlanId),
          gte(inventory.date, input.checkIn),
          lt(inventory.date, input.checkOut)
        )
      );
    if (inv.length < nights || inv.some((d) => d.unitsAvailable < 1)) {
      throw new PrepareBookingError(
        "Room is no longer available for these dates",
        409,
        "room_sold_out"
      );
    }
  }

  const [room] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.id, input.roomTypeId))
    .limit(1);
  if (!room) {
    throw new PrepareBookingError("Room type not found", 404);
  }

  const [ratePlan] = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.id, input.ratePlanId))
    .limit(1);
  if (!ratePlan) {
    throw new PrepareBookingError("Rate plan not found", 404);
  }

  const isRefundable = ratePlan.isRefundable !== false;
  const rateType: "flex" | "nr" = isRefundable ? "flex" : "nr";

  // body.totalPrice is room + extras (client computed, via the same pricing
  // helper used below). Split it back out so the booking row records each line.
  const extrasItems = input.extras ?? [];
  const guests = (input.adults ?? 1) + (input.children ?? 0);

  // Pricing model per selected extra — looked up server-side (Cloudbeds doesn't
  // carry it, and we don't trust the client) so quantities can't be tampered.
  const extraModels = new Map<string, PricingModel>();
  if (extrasItems.length > 0) {
    const modelRows = await db
      .select({
        id: propertyExtras.id,
        pricingModel: propertyExtras.pricingModel,
      })
      .from(propertyExtras)
      .where(eq(propertyExtras.propertyId, input.propertyId));
    for (const r of modelRows) {
      extraModels.set(
        r.id,
        isPricingModel(r.pricingModel) ? r.pricingModel : "per_stay"
      );
    }
  }
  const modelFor = (id: string): PricingModel =>
    extraModels.get(id) ?? "per_stay";

  // Sanitise any guest-supplied per_guest_per_night options (breakfast) against
  // the real headcount + stay mornings so a tampered client can't forge them.
  const allMornings = stayMornings(input.checkIn, nights);
  const validMorningSet = new Set(allMornings);
  const configFor = (e: PrepareExtraInput): ExtraConfig | undefined => {
    if (modelFor(e.id) !== "per_guest_per_night" || !e.config) return undefined;
    return {
      guests: Math.max(0, Math.min(guests, Math.floor(e.config.guests ?? 0))),
      mornings: (e.config.mornings ?? []).filter((d) => validMorningSet.has(d)),
    };
  };

  const extrasTotalNum = extrasItems.reduce(
    (sum, e) =>
      sum +
      extraLineTotal(
        e.priceMinorUnits / 100,
        modelFor(e.id),
        nights,
        guests,
        configFor(e)
      ),
    0
  );
  const roomTotalNum = input.totalPrice - extrasTotalNum;
  const grandTotalNum = input.totalPrice;
  const feePercent = Number(property.platformFeePercent ?? "3.00");

  // Snapshot the rate plan's current cancellation policy. Even if the admin
  // edits the policy later, this booking is governed by what was published
  // at the time the guest paid.
  const cancellationPolicySnapshot = ratePlan.cancellationPolicy ?? {
    isRefundable,
    note: "no policy configured at booking time",
  };

  // Flex bookings auto-charge when the cancellation window closes — that's the
  // moment the booking becomes non-refundable, so the platform takes payment
  // then. Fallback to 24h before check-in when no deadline is configured. NR is
  // paid at checkout, so chargeAt stays null.
  let chargeAt: Date | null = null;
  if (rateType === "flex") {
    const policy = cancellationPolicySnapshot as { deadlineHours?: number };
    const deadlineHours =
      typeof policy.deadlineHours === "number" ? policy.deadlineHours : 24;
    const checkInUtc = new Date(`${input.checkIn}T00:00:00Z`);
    chargeAt = new Date(checkInUtc.getTime() - deadlineHours * 60 * 60 * 1000);
  }

  // Build the extras INTENT rows (sans bookingId). One row per selected extra,
  // carrying the resolved posting plan + a link to the catalogue row.
  //  - per_stay (Early Check-In, …): one folio line, quantity 1.
  //  - per_guest_per_night (breakfast): one dated line PER chosen morning
  //    (quantity = guests that morning); a single row keeps the total qty and
  //    fulfilBooking comma-joins the per-morning ids.
  const extraIntentRows: Omit<
    typeof bookingExtras.$inferInsert,
    "bookingId"
  >[] = [];
  for (const extra of extrasItems) {
    const unitMajor = extra.priceMinorUnits / 100;
    const model = modelFor(extra.id);
    if (model === "per_guest_per_night") {
      const cfg = configFor(extra) ?? { guests, mornings: allMornings };
      if (cfg.guests <= 0 || cfg.mornings.length === 0) continue;
      const totalQty = cfg.guests * cfg.mornings.length;
      extraIntentRows.push({
        name: extra.name,
        qty: totalQty,
        unitPrice: unitMajor.toFixed(2),
        totalPrice: (unitMajor * totalQty).toFixed(2),
        currency: extra.currency,
        propertyExtraId: extra.id,
        postingPlan: { model, perMorning: cfg.guests, mornings: cfg.mornings },
      });
    } else {
      extraIntentRows.push({
        name: extra.name,
        qty: 1,
        unitPrice: unitMajor.toFixed(2),
        totalPrice: unitMajor.toFixed(2),
        currency: extra.currency,
        propertyExtraId: extra.id,
        postingPlan: { model: "per_stay" },
      });
    }
  }

  return {
    property,
    room,
    ratePlan,
    rateType,
    nights,
    roomTotal: roomTotalNum.toFixed(2),
    extrasTotal: extrasTotalNum.toFixed(2),
    grandTotal: grandTotalNum.toFixed(2),
    applicationFee: ((grandTotalNum * feePercent) / 100).toFixed(2),
    // A Ryft-active property settles in its sub-account currency, and every Ryft
    // money path (pay-now, card-save, auto-charge) charges in ryftAccountCurrency
    // regardless of property.currency (which the Cloudbeds sync can flip to USD).
    // Denominate the booking in that same currency so the stored row, the
    // confirmation page, and the email all match what's actually charged.
    currency:
      property.ryftAccountStatus === "active" && property.ryftAccountCurrency
        ? property.ryftAccountCurrency
        : input.currency ?? property.currency ?? "GBP",
    cancellationPolicySnapshot,
    chargeAt,
    extraIntentRows,
  };
}
