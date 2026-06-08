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
import { format, parseISO } from "date-fns";
import { getStripe } from "@/lib/stripe/client";
import { getPmsAdapter } from "@/lib/pms";
import { PmsSoldOutError } from "@/lib/pms/errors";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { signCancelToken } from "@/lib/crypto";
import { publicOrigin } from "@/lib/stripe/client";

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
  // Mews ProductOrders need the product id + its Orderable service id; looked up
  // server-side (trusted) keyed by our extra id. Cloudbeds ignores both.
  const extraOtaId = new Map<string, string>();
  const extraServiceId = new Map<string, string | null>();
  if (extrasItems.length > 0) {
    const modelRows = await db
      .select({
        id: propertyExtras.id,
        pricingModel: propertyExtras.pricingModel,
        otaExtraId: propertyExtras.otaExtraId,
        pmsServiceId: propertyExtras.pmsServiceId,
      })
      .from(propertyExtras)
      .where(eq(propertyExtras.propertyId, body.propertyId));
    for (const r of modelRows) {
      extraModels.set(
        r.id,
        isPricingModel(r.pricingModel) ? r.pricingModel : "per_stay"
      );
      extraOtaId.set(r.id, r.otaExtraId);
      extraServiceId.set(r.id, r.pmsServiceId);
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

  // Cloudbeds postReservation. If this fails, the booking row exists with
  // money taken (NR) or card saved (Flex) but no PMS reservation. Per build
  // plan: land happy path; the retry/refund recovery flow lands before launch.
  let cloudbedsReservationId: string | undefined;
  let cancelUrl: string | undefined;
  const pms = getPmsAdapter(property);
  try {
    const result = await pms.createReservation({
      startDate: body.checkIn,
      endDate: body.checkOut,
      guestFirstName: body.guestFirst,
      guestLastName: body.guestLast,
      guestEmail: body.guestEmail,
      guestCountry: body.guestCountry ?? undefined,
      guestPhone: body.guestPhone ?? undefined,
      roomTypeId: room.otaRoomId,
      rateId: ratePlan.otaRateId,
      adults: body.adults ?? 1,
      children: body.children ?? 0,
      // Room subtotal only — extras are attached separately via postExtra.
      // (Cloudbeds prices the room from roomRateID inside postReservation; this
      // value is informational. Previously sent room+extras, which was wrong.)
      roomSubtotal: roomTotalNum,
      orderId: body.orderId,
      // Per-night prices for PMSs that need them (Mews TimeUnitPrices). Cloudbeds
      // ignores this. Falls back to undefined if the client didn't send a breakdown.
      nightlyRates: body.nightlyRates?.map((nr) => ({
        date: nr.date,
        rate: nr.rate,
      })),
    });
    cloudbedsReservationId = result.pmsReservationId;

    // Attach extras to the folio. Insert our row before the Cloudbeds call so
    // the line survives a postCustomItem failure (the retry sweep at
    // /api/admin/properties/[id]/cloudbeds/sync-pending-extras picks up rows
    // left with cloudbedsItemId = null).
    //
    //  - per_stay (Early Check-In, …): one folio line, quantity 1.
    //  - per_guest_per_night (breakfast): ONE dated line PER chosen morning
    //    (quantity = guests that morning), so the folio's Service Date column +
    //    Cloudbeds' "items by date" reports give staff the per-day counts. Our
    //    bookingExtras keeps a single row (total qty) with the per-morning IDs
    //    comma-joined in cloudbedsItemId.
    const noteLines: string[] = [];
    const emailExtras: { name: string; quantity: number; lineTotal: number }[] = [];
    for (const extra of extrasItems) {
      const unitMajor = extra.priceMinorUnits / 100;

      if (modelFor(extra.id) === "per_guest_per_night") {
        const cfg = configFor(extra) ?? { guests, mornings: allMornings };
        const perMorning = cfg.guests;
        const mornings = cfg.mornings;
        if (perMorning <= 0 || mornings.length === 0) continue;
        const totalQty = perMorning * mornings.length;

        const [extraRow] = await db
          .insert(bookingExtras)
          .values({
            bookingId: booking.id,
            cloudbedsItemId: null,
            name: extra.name,
            qty: totalQty,
            unitPrice: unitMajor.toFixed(2),
            totalPrice: (unitMajor * totalQty).toFixed(2),
            currency: extra.currency,
          })
          .returning({ id: bookingExtras.id });

        const itemIds: string[] = [];
        for (const morning of mornings) {
          try {
            const { pmsItemId } = await pms.postExtra({
              reservationId: cloudbedsReservationId,
              name: extra.name,
              amount: unitMajor,
              quantity: perMorning,
              serviceDate: morning,
              otaExtraId: extraOtaId.get(extra.id),
              pmsServiceId: extraServiceId.get(extra.id) ?? undefined,
            });
            if (pmsItemId) itemIds.push(pmsItemId);
          } catch (extraErr) {
            console.error(
              `postCustomItem failed for ${extra.name} (${morning}) on reservation ${cloudbedsReservationId}:`,
              extraErr
            );
          }
        }
        if (itemIds.length > 0) {
          await db
            .update(bookingExtras)
            .set({ cloudbedsItemId: itemIds.join(",") })
            .where(eq(bookingExtras.id, extraRow.id));
        }
        noteLines.push(
          `${extra.name}: ${perMorning} guest${perMorning === 1 ? "" : "s"} × ${mornings
            .map(fmtMorning)
            .join(", ")} (${totalQty} total)`
        );
        emailExtras.push({ name: extra.name, quantity: totalQty, lineTotal: unitMajor * totalQty });
        continue;
      }

      // per_stay — one folio line, quantity 1
      const [extraRow] = await db
        .insert(bookingExtras)
        .values({
          bookingId: booking.id,
          cloudbedsItemId: null,
          name: extra.name,
          qty: 1,
          unitPrice: unitMajor.toFixed(2),
          totalPrice: unitMajor.toFixed(2),
          currency: extra.currency,
        })
        .returning({ id: bookingExtras.id });
      emailExtras.push({ name: extra.name, quantity: 1, lineTotal: unitMajor });
      try {
        const { pmsItemId } = await pms.postExtra({
          reservationId: cloudbedsReservationId,
          name: extra.name,
          amount: unitMajor,
          quantity: 1,
          otaExtraId: extraOtaId.get(extra.id),
          pmsServiceId: extraServiceId.get(extra.id) ?? undefined,
        });
        if (pmsItemId) {
          await db
            .update(bookingExtras)
            .set({ cloudbedsItemId: pmsItemId })
            .where(eq(bookingExtras.id, extraRow.id));
        }
      } catch (extraErr) {
        console.error(
          `postCustomItem failed for ${extra.name} on reservation ${cloudbedsReservationId}:`,
          extraErr
        );
      }
    }

    // Staff-facing reservation note: which breakfasts, how many, on which
    // mornings. Non-fatal — a failed note never voids the booking.
    if (noteLines.length > 0) {
      try {
        await pms.postReservationNote({
          reservationId: cloudbedsReservationId,
          note: noteLines.join(" | "),
        });
      } catch (noteErr) {
        console.error(
          `postReservationNote failed for reservation ${cloudbedsReservationId}:`,
          noteErr
        );
      }
    }

    // For NR rates: record the Stripe charge in the Cloudbeds folio so the
    // hotel's accounting reflects what the guest paid. Failure here doesn't
    // void the booking — the money is already with Stripe; missing folio
    // line is a reconciliation problem the hotel can fix manually.
    if (rateType === "nr" && body.paymentIntentId) {
      try {
        await pms.recordPayment({
          reservationId: cloudbedsReservationId,
          amount: grandTotalNum,
          type: "credit",
          description: `Stripe ${body.paymentIntentId}`,
          externalIdentifier: body.paymentIntentId,
        });
      } catch (payErr) {
        console.error(
          `postPayment failed for reservation ${cloudbedsReservationId}:`,
          payErr
        );
      }
    }

    await db
      .update(bookings)
      .set({
        cloudbedsReservationId,
        status: "pms_synced",
      })
      .where(eq(bookings.id, booking.id));

    // Self-cancel link only for Flex bookings — NR has no self-cancel path
    // (the cancel route returns "non_refundable" / "contact hotel" for those).
    cancelUrl =
      rateType === "flex"
        ? `${publicOrigin()}/cancel/${signCancelToken(booking.id)}`
        : undefined;

    // Fire-and-forget confirmation email. Booking is already done; a failed
    // send is a customer-service problem, not a booking-failure problem.
    void (async () => {
      try {
        await sendBookingConfirmationEmail({
          propertyId: property.id,
          bookingId: booking.id,
          to: body.guestEmail,
          guestFirstName: body.guestFirst,
          guestLastName: body.guestLast,
          hotelName: property.name,
          cloudbedsReservationId: cloudbedsReservationId!,
          orderId: body.orderId,
          rateType,
          roomName: room.name,
          rateName: ratePlan.name,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          nights,
          adults: body.adults ?? 1,
          currency: body.currency ?? "GBP",
          roomTotal: roomTotalNum,
          extrasTotal: extrasTotalNum,
          grandTotal: grandTotalNum,
          extras: emailExtras,
          cancelUrl,
        });
      } catch (emailErr) {
        console.error(
          `Confirmation email failed for booking ${booking.id} (reservation ${cloudbedsReservationId}):`,
          emailErr
        );
      }
    })();
  } catch (err) {
    // Sold-out: the PMS refused to oversell (final defence after the pre-create
    // availability re-check). Retrying won't help — tell the guest to pick
    // another room. Distinct code + 409 so the storefront shows the right UX.
    if (err instanceof PmsSoldOutError) {
      console.warn(
        `Booking ${booking.id} (${body.orderId}): room sold out at PMS create.`
      );
      return NextResponse.json(
        {
          success: false,
          code: "room_sold_out",
          orderId: body.orderId,
          bookingId: booking.id,
          error: err.message,
        },
        { status: 409 }
      );
    }
    console.error("Cloudbeds postReservation failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        orderId: body.orderId,
        bookingId: booking.id,
        error: `Booking saved but Cloudbeds sync failed: ${message}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    orderId: body.orderId,
    bookingId: booking.id,
    cloudbedsReservationId,
    cancelUrl,
  });
}

// Short morning label for the staff reservation note, e.g. "Wed 28 May".
function fmtMorning(d: string): string {
  try {
    return format(parseISO(d), "EEE d MMM");
  } catch {
    return d;
  }
}
