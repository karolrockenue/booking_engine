import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, bookingDayRates, bookingExtras } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  prepareBooking,
  PrepareBookingError,
  type PrepareExtraInput,
} from "@/lib/booking/prepare-booking";
import { getStripe, publicOrigin } from "@/lib/stripe/client";
import { fulfilBooking } from "@/lib/pms/fulfil-booking";
import { signCancelToken } from "@/lib/crypto";

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
  extras?: PrepareExtraInput[];
  paymentIntentId?: string;
  setupIntentId?: string;
  paymentMethodId?: string;
  customerId?: string;
}

// Finalise a booking (Step 0b). The row is normally already created by
// /api/bookings/init (create-before-pay); this route verifies the Stripe intent
// succeeded, patches the final guest details, flips the row to
// paid/payment_authorized, and fulfils it through the single idempotent
// fulfilBooking() unit (the same one driven by the Stripe webhook + retry cron).
//
// If no row exists for the orderId (a pre-0b client, or a path that skipped
// init), it falls back to creating the row here first — so the route stays safe
// to call standalone.
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

  // Find the row created by init (the normal case).
  let [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, body.orderId))
    .limit(1);

  // Already fulfilled — idempotent return (double-submit / refresh-after-success).
  if (booking?.cloudbedsReservationId) {
    const cancelUrl =
      booking.rateType === "flex"
        ? `${publicOrigin()}/cancel/${signCancelToken(booking.id)}`
        : undefined;
    return NextResponse.json({
      success: true,
      orderId: booking.orderId,
      bookingId: booking.id,
      cloudbedsReservationId: booking.cloudbedsReservationId,
      cancelUrl,
    });
  }

  // Create-if-absent fallback: no init ran for this order. Re-prepare + persist
  // the row + day-rates + extras intent here so fulfilment has everything.
  if (!booking) {
    let prepared;
    try {
      prepared = await prepareBooking(body);
    } catch (err) {
      if (err instanceof PrepareBookingError) {
        return NextResponse.json(
          { error: err.message, code: err.code },
          { status: err.status }
        );
      }
      throw err;
    }

    [booking] = await db
      .insert(bookings)
      .values({
        propertyId: body.propertyId,
        orderId: body.orderId,
        roomTypeId: body.roomTypeId,
        ratePlanId: body.ratePlanId,
        rateType: prepared.rateType,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        adults: body.adults ?? 1,
        children: body.children ?? 0,
        guestFirst: body.guestFirst,
        guestLast: body.guestLast,
        guestEmail: body.guestEmail,
        guestPhone: body.guestPhone ?? null,
        guestCountry: body.guestCountry ?? null,
        roomTotal: prepared.roomTotal,
        extrasTotal: prepared.extrasTotal,
        taxesTotal: "0.00",
        applicationFee: prepared.applicationFee,
        grandTotal: prepared.grandTotal,
        currency: prepared.currency,
        chargeAt: prepared.chargeAt,
        cancellationPolicySnapshot: prepared.cancellationPolicySnapshot,
        status: "pending",
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
    if (prepared.extraIntentRows.length > 0) {
      await db.insert(bookingExtras).values(
        prepared.extraIntentRows.map((r) => ({ ...r, bookingId: booking.id }))
      );
    }
  }

  // Server-side Stripe verification: trust nothing the client says. The intent
  // id is the one the browser confirmed, falling back to the one init stored.
  const rateType: "flex" | "nr" = booking.rateType === "nr" ? "nr" : "flex";
  const stripe = getStripe();
  let initialStatus: "paid" | "payment_authorized";

  if (rateType === "nr") {
    const piId = body.paymentIntentId ?? booking.stripePaymentIntentId;
    if (!piId) {
      return NextResponse.json(
        { error: "Non-refundable rate requires paymentIntentId" },
        { status: 400 }
      );
    }
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
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
    const siId = body.setupIntentId ?? booking.stripeSetupIntentId;
    if (!siId) {
      return NextResponse.json(
        { error: "Refundable rate requires setupIntentId" },
        { status: 400 }
      );
    }
    try {
      const si = await stripe.setupIntents.retrieve(siId);
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

  // Patch the final guest details + Stripe ids, then flip the row out of
  // "pending". This is what makes the row eligible for the retry cron and tells
  // fulfilBooking the guest (Mews needs LastName, Cloudbeds an ISO country) is
  // known. Done AFTER verification so an unpaid row is never advanced.
  await db
    .update(bookings)
    .set({
      guestFirst: body.guestFirst,
      guestLast: body.guestLast,
      guestEmail: body.guestEmail,
      guestPhone: body.guestPhone ?? booking.guestPhone ?? null,
      guestCountry: body.guestCountry ?? booking.guestCountry ?? null,
      stripePaymentIntentId:
        body.paymentIntentId ?? booking.stripePaymentIntentId ?? null,
      stripeSetupIntentId:
        body.setupIntentId ?? booking.stripeSetupIntentId ?? null,
      stripePaymentMethodId:
        body.paymentMethodId ?? booking.stripePaymentMethodId ?? null,
      stripeCustomerId: body.customerId ?? booking.stripeCustomerId ?? null,
      status: initialStatus,
    })
    .where(eq(bookings.id, booking.id));

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
