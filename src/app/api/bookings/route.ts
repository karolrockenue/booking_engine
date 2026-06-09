import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bookings,
  bookingDayRates,
  bookingExtras,
  inventory,
  ratePlans,
  properties,
  propertyExtras,
  roomTypes,
} from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import {
  extraLineTotal,
  isPricingModel,
  stayMornings,
} from "@/lib/booking/extra-pricing";
import type { ExtraConfig, PricingModel } from "@/lib/booking/types";
import { getStripe } from "@/lib/stripe/client";
import { getPmsAdapter } from "@/lib/pms";
import { fulfilBooking } from "@/lib/pms/fulfil-booking";

interface ExtraInput {
  id: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
  config?: { guests: number; mornings: string[] };
}

interface BookingRequestBody {
  propertyId: string;
  orderId: string; // client-generated, same as Stripe metadata.orderId
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guestFirst: string;
  guestLast: string;
  guestEmail: string;
  guestPhone?: string;
  guestCountry?: string;
  nightlyRates: Array<{ date: string; rate: number; rateId?: string }>;
  totalPrice: number;
  currency: string;
  extras?: ExtraInput[];
  paymentIntentId?: string;
  setupIntentId?: string;
  paymentMethodId?: string;
  customerId?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BookingRequestBody;

  if (
    !body.propertyId ||
    !body.orderId ||
    !body.roomTypeId ||
    !body.ratePlanId ||
    !body.checkIn ||
    !body.checkOut ||
    !body.guestFirst ||
    !body.guestLast ||
    !body.guestEmail ||
    body.totalPrice === undefined
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!body.paymentIntentId && !body.setupIntentId) {
    return NextResponse.json(
      { error: "Missing paymentIntentId or setupIntentId" },
      { status: 400 }
    );
  }

  // Idempotent retry: if a booking with this orderId already exists, return
  // it. Covers double-submit, network retry, and refresh-after-success.
  const [existing] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, body.orderId))
    .limit(1);
  if (existing) {
    return NextResponse.json({
      success: true,
      orderId: existing.orderId,
      bookingId: existing.id,
      cloudbedsReservationId: existing.cloudbedsReservationId ?? undefined,
    });
  }

  const checkInDate = new Date(body.checkIn);
  const checkOutDate = new Date(body.checkOut);
  const nights =
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24);

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, body.propertyId))
    .limit(1);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Final availability re-check, PMS-aware. Cloudbeds keeps its direct
  // inventory-table check; Mews stores availability in its own native tables,
  // so we re-check through the adapter and confirm the chosen room+rate is
  // still offered for the dates.
  if (property.pmsType === "mews") {
    const avail = await getPmsAdapter(property).getAvailability(
      body.checkIn,
      body.checkOut,
      body.adults ?? 1
    );
    const stillAvailable = avail.some(
      (r) =>
        r.roomType.id === body.roomTypeId && r.ratePlan.id === body.ratePlanId
    );
    if (!stillAvailable) {
      return NextResponse.json(
        { error: "Room is no longer available for these dates" },
        { status: 409 }
      );
    }
  } else {
    if (!property.cloudbedsPropertyId) {
      return NextResponse.json(
        { error: "Property is not connected to Cloudbeds" },
        { status: 409 }
      );
    }
    const inv = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.propertyId, body.propertyId),
          eq(inventory.roomTypeId, body.roomTypeId),
          eq(inventory.ratePlanId, body.ratePlanId),
          gte(inventory.date, body.checkIn),
          lt(inventory.date, body.checkOut)
        )
      );
    if (inv.length < nights || inv.some((d) => d.unitsAvailable < 1)) {
      return NextResponse.json(
        { error: "Room is no longer available for these dates" },
        { status: 409 }
      );
    }
  }

  const [room] = await db
    .select()
    .from(roomTypes)
    .where(eq(roomTypes.id, body.roomTypeId))
    .limit(1);
  if (!room) {
    return NextResponse.json({ error: "Room type not found" }, { status: 404 });
  }

  const [ratePlan] = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.id, body.ratePlanId))
    .limit(1);
  if (!ratePlan) {
    return NextResponse.json({ error: "Rate plan not found" }, { status: 404 });
  }

  const isRefundable = ratePlan.isRefundable !== false;
  const rateType: "flex" | "nr" = isRefundable ? "flex" : "nr";

  // Server-side Stripe verification: trust nothing the client says.
  const stripe = getStripe();
  let initialStatus: "paid" | "payment_authorized";

  if (rateType === "nr") {
    if (!body.paymentIntentId) {
      return NextResponse.json(
        { error: "Non-refundable rate requires paymentIntentId" },
        { status: 400 }
      );
    }
    try {
      const pi = await stripe.paymentIntents.retrieve(body.paymentIntentId);
      if (pi.status !== "succeeded") {
        return NextResponse.json(
          { error: `PaymentIntent not succeeded: ${pi.status}` },
          { status: 409 }
        );
      }
    } catch (err) {
      console.error("Stripe PaymentIntent retrieve failed:", err);
      return NextResponse.json(
        { error: "Could not verify payment" },
        { status: 502 }
      );
    }
    initialStatus = "paid";
  } else {
    if (!body.setupIntentId) {
      return NextResponse.json(
        { error: "Refundable rate requires setupIntentId" },
        { status: 400 }
      );
    }
    try {
      const si = await stripe.setupIntents.retrieve(body.setupIntentId);
      if (si.status !== "succeeded") {
        return NextResponse.json(
          { error: `SetupIntent not succeeded: ${si.status}` },
          { status: 409 }
        );
      }
    } catch (err) {
      console.error("Stripe SetupIntent retrieve failed:", err);
      return NextResponse.json(
        { error: "Could not verify saved card" },
        { status: 502 }
      );
    }
    initialStatus = "payment_authorized";
  }

  // body.totalPrice is room + extras (client computed, via the same pricing
  // helper used below). Split it back out so the booking row records each line.
  const extrasItems = body.extras ?? [];
  const guests = (body.adults ?? 1) + (body.children ?? 0);

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
      .where(eq(propertyExtras.propertyId, body.propertyId));
    for (const r of modelRows) {
      extraModels.set(
        r.id,
        isPricingModel(r.pricingModel) ? r.pricingModel : "per_stay"
      );
    }
  }
  const modelFor = (id: string): PricingModel => extraModels.get(id) ?? "per_stay";

  // Sanitise any guest-supplied per_guest_per_night options (breakfast) against
  // the real headcount + stay mornings so a tampered client can't forge them.
  const allMornings = stayMornings(body.checkIn, nights);
  const validMorningSet = new Set(allMornings);
  const configFor = (e: ExtraInput): ExtraConfig | undefined => {
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
  const roomTotalNum = body.totalPrice - extrasTotalNum;
  const grandTotalNum = body.totalPrice;

  const roomTotal = roomTotalNum.toFixed(2);
  const extrasTotal = extrasTotalNum.toFixed(2);
  const grandTotal = grandTotalNum.toFixed(2);
  const feePercent = Number(property.platformFeePercent ?? "3.00");
  const applicationFee = ((grandTotalNum * feePercent) / 100).toFixed(2);

  // Snapshot the rate plan's current cancellation policy. Even if the admin
  // edits the policy later, this booking is governed by what was published
  // at the time the guest paid.
  const cancellationPolicySnapshot = ratePlan.cancellationPolicy ?? {
    isRefundable,
    note: "no policy configured at booking time",
  };

  // Flex bookings auto-charge when the cancellation window closes — that's
  // the moment the booking becomes non-refundable, so the platform takes
  // payment then. Fallback to 24h before check-in when no deadline is
  // configured. NR is paid at checkout, so chargeAt stays null.
  let chargeAt: Date | null = null;
  if (rateType === "flex") {
    const policy = cancellationPolicySnapshot as { deadlineHours?: number };
    const deadlineHours =
      typeof policy.deadlineHours === "number" ? policy.deadlineHours : 24;
    const checkInUtc = new Date(`${body.checkIn}T00:00:00Z`);
    chargeAt = new Date(checkInUtc.getTime() - deadlineHours * 60 * 60 * 1000);
  }

  const [booking] = await db
    .insert(bookings)
    .values({
      propertyId: body.propertyId,
      orderId: body.orderId,
      roomTypeId: body.roomTypeId,
      ratePlanId: body.ratePlanId,
      rateType,
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      adults: body.adults ?? 1,
      children: body.children ?? 0,
      guestFirst: body.guestFirst,
      guestLast: body.guestLast,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone ?? null,
      guestCountry: body.guestCountry ?? null,
      roomTotal,
      extrasTotal,
      taxesTotal: "0.00",
      applicationFee,
      grandTotal,
      currency: body.currency ?? "GBP",
      stripePaymentIntentId: body.paymentIntentId ?? null,
      stripeSetupIntentId: body.setupIntentId ?? null,
      stripePaymentMethodId: body.paymentMethodId ?? null,
      stripeCustomerId: body.customerId ?? null,
      chargeAt,
      cancellationPolicySnapshot,
      status: initialStatus,
    })
    .returning();

  if (body.nightlyRates && body.nightlyRates.length > 0) {
    await db.insert(bookingDayRates).values(
      body.nightlyRates.map((nr) => ({
        bookingId: booking.id,
        date: nr.date,
        rate: nr.rate.toFixed(2),
        rateId: nr.rateId ?? null,
      }))
    );
  }

  // Persist the extras INTENT before any PMS call — one bookingExtras row per
  // selected extra, carrying the resolved posting plan (model + per-morning
  // breakdown) and a link to the catalogue row. fulfilBooking() reads these and
  // posts them to the folio; persisting first means the lines survive a failed
  // post and can be completed by the Stripe webhook or the retry cron.
  //
  //  - per_stay (Early Check-In, …): one folio line, quantity 1.
  //  - per_guest_per_night (breakfast): one dated line PER chosen morning
  //    (quantity = guests that morning); bookingExtras keeps a single row (total
  //    qty) and fulfilBooking comma-joins the per-morning ids.
  const extraIntentRows: (typeof bookingExtras.$inferInsert)[] = [];
  for (const extra of extrasItems) {
    const unitMajor = extra.priceMinorUnits / 100;
    const model = modelFor(extra.id);
    if (model === "per_guest_per_night") {
      const cfg = configFor(extra) ?? { guests, mornings: allMornings };
      if (cfg.guests <= 0 || cfg.mornings.length === 0) continue;
      const totalQty = cfg.guests * cfg.mornings.length;
      extraIntentRows.push({
        bookingId: booking.id,
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
        bookingId: booking.id,
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
  if (extraIntentRows.length > 0) {
    await db.insert(bookingExtras).values(extraIntentRows);
  }

  // Fulfil synchronously (the happy path): create reservation → post extras →
  // record the external payment → staff note → confirmation email → status.
  // The same idempotent, claim-locked unit also runs from the Stripe webhook and
  // the retry cron, so a failure here is recoverable rather than lost.
  const result = await fulfilBooking(booking.id);

  if (result.outcome === "sold_out") {
    // PMS refused to oversell (final defence after the pre-create availability
    // re-check). Distinct code + 409 so the storefront shows "pick another room".
    console.warn(
      `Booking ${booking.id} (${body.orderId}): room sold out at PMS create.`
    );
    return NextResponse.json(
      {
        success: false,
        code: "room_sold_out",
        orderId: body.orderId,
        bookingId: booking.id,
        error: result.reason ?? "Room is no longer available",
      },
      { status: 409 }
    );
  }

  if (result.outcome !== "synced") {
    // Booking + extras intent are persisted; the Stripe webhook and retry cron
    // will complete the PMS write. Surface the error to the guest (today's
    // behaviour); Phase 2 turns this into a 202 + status poll instead.
    console.error(
      `Booking ${booking.id} (${body.orderId}) fulfilment failed: ${result.reason}`
    );
    return NextResponse.json(
      {
        success: false,
        orderId: body.orderId,
        bookingId: booking.id,
        error: `Booking saved but PMS sync failed: ${result.reason ?? "unknown"}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    orderId: body.orderId,
    bookingId: booking.id,
    cloudbedsReservationId: result.pmsReservationId,
    cancelUrl: result.cancelUrl,
  });
}
