import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bookings,
  bookingDayRates,
  bookingExtras,
  inventory,
  ratePlans,
  properties,
  roomTypes,
} from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/client";
import {
  postReservation,
  postCustomItem,
  postPayment,
} from "@/lib/cloudbeds/reservations";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { signCancelToken } from "@/lib/crypto";
import { publicOrigin } from "@/lib/stripe/client";

interface ExtraInput {
  id: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
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

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, body.propertyId))
    .limit(1);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (!property.cloudbedsPropertyId) {
    return NextResponse.json(
      { error: "Property is not connected to Cloudbeds" },
      { status: 409 }
    );
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

  // body.totalPrice is room + extras (client computed). Split it back out so
  // the booking row records each line correctly.
  const extrasItems = body.extras ?? [];
  const extrasTotalNum = extrasItems.reduce(
    (sum, e) => sum + e.priceMinorUnits / 100,
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
  try {
    const result = await postReservation(body.propertyId, {
      cloudbedsPropertyId: property.cloudbedsPropertyId,
      startDate: body.checkIn,
      endDate: body.checkOut,
      guestFirstName: body.guestFirst,
      guestLastName: body.guestLast,
      guestEmail: body.guestEmail,
      guestCountry: body.guestCountry ?? undefined,
      guestPhone: body.guestPhone ?? undefined,
      roomTypeID: room.otaRoomId,
      ratesID: ratePlan.otaRateId,
      adults: body.adults ?? 1,
      children: body.children ?? 0,
      // Room subtotal only — extras are attached separately via postCustomItem.
      // (Cloudbeds prices the room from roomRateID inside postReservation; this
      // value is informational. Previously sent room+extras, which was wrong.)
      subtotal: roomTotalNum,
      thirdPartyIdentifier: body.orderId,
    });
    cloudbedsReservationId = result.reservationID;

    // Attach each extra as a folio line item. One Cloudbeds call per extra
    // (no batch endpoint). Insert the row locally before the Cloudbeds call
    // so the line item survives a postCustomItem failure — the common case
    // today is the write:item scope not yet being granted by Cloudbeds.
    // Failed rows keep cloudbedsItemId = null; the
    // /api/admin/properties/[id]/cloudbeds/sync-pending-extras endpoint
    // sweeps them and retries once the scope is enabled.
    for (const extra of extrasItems) {
      const unitMajor = extra.priceMinorUnits / 100;
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

      try {
        const { itemID } = await postCustomItem(body.propertyId, {
          cloudbedsPropertyId: property.cloudbedsPropertyId,
          reservationID: cloudbedsReservationId,
          name: extra.name,
          amount: unitMajor,
          quantity: 1,
        });
        if (itemID) {
          await db
            .update(bookingExtras)
            .set({ cloudbedsItemId: itemID })
            .where(eq(bookingExtras.id, extraRow.id));
        }
      } catch (extraErr) {
        console.error(
          `postCustomItem failed for ${extra.name} on reservation ${cloudbedsReservationId}:`,
          extraErr
        );
        // Row stays with cloudbedsItemId = null. Retry sweep picks it up.
      }
    }

    // For NR rates: record the Stripe charge in the Cloudbeds folio so the
    // hotel's accounting reflects what the guest paid. Failure here doesn't
    // void the booking — the money is already with Stripe; missing folio
    // line is a reconciliation problem the hotel can fix manually.
    if (rateType === "nr" && body.paymentIntentId) {
      try {
        await postPayment(body.propertyId, {
          cloudbedsPropertyId: property.cloudbedsPropertyId,
          reservationID: cloudbedsReservationId,
          amount: grandTotalNum,
          type: "credit",
          description: `Stripe ${body.paymentIntentId}`,
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
    const cancelUrl =
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
  });
}
