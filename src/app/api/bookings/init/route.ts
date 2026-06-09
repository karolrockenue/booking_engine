import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, bookingDayRates, bookingExtras } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  prepareBooking,
  PrepareBookingError,
  type PrepareExtraInput,
} from "@/lib/booking/prepare-booking";
import {
  createBookingPaymentIntent,
  createBookingSetupIntent,
  StripeIntentError,
} from "@/lib/stripe/intents";

// Create-before-pay (Step 0b). Fired when the guest enters their email — BEFORE
// the card is confirmed. Persists the full booking row (status "pending", guest
// name filled later at confirm) + day-rates + extras intent, then creates the
// Stripe intent. From here on the server can fulfil independently of the
// browser: if the tab dies after the charge, the Stripe webhook still has a row.
//
// The booking stays "pending" until the finalise call (POST /api/bookings)
// patches the guest details + verifies the intent + flips it to
// paid/payment_authorized. The retry cron only picks paid/payment_authorized
// rows, so a detail-less pending row is never fulfilled (invariant §3.3/§3.4).

interface InitBookingBody {
  propertyId: string;
  orderId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guestEmail?: string;
  guestFirst?: string;
  guestLast?: string;
  guestPhone?: string;
  guestCountry?: string;
  nightlyRates: Array<{ date: string; rate: number; rateId?: string }>;
  totalPrice: number;
  currency: string;
  extras?: PrepareExtraInput[];
}

interface InitResponse {
  bookingId: string;
  clientSecret: string;
  paymentIntentId?: string;
  setupIntentId?: string;
  customerId?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as InitBookingBody;

  if (
    !body.propertyId ||
    !body.orderId ||
    !body.roomTypeId ||
    !body.ratePlanId ||
    !body.checkIn ||
    !body.checkOut ||
    body.totalPrice === undefined
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Email is optional at init: some themes render the Stripe element before the
  // guest types it. The row stores "" now and the details-patch backfills it
  // before any charge (so fulfilment always has a real email).
  const guestEmail = body.guestEmail ?? "";

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

  // Idempotency on orderId: a re-fired init (re-render, email re-edit) must not
  // create a second row. Reuse the existing booking and re-issue its intent —
  // Stripe's idempotency key returns the same intent + client secret.
  const [existing] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, body.orderId))
    .limit(1);

  const booking =
    existing ??
    (
      await db
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
          // Name is patched at confirm (NOT NULL columns → placeholders now).
          guestFirst: body.guestFirst ?? "",
          guestLast: body.guestLast ?? "",
          guestEmail,
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
        .returning()
    )[0];

  // Day-rates + extras intent only on first creation (idempotent re-init skips).
  if (!existing) {
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

  // Create (or idempotently re-fetch) the Stripe intent.
  let intent: InitResponse;
  try {
    if (prepared.rateType === "nr") {
      const pi = await createBookingPaymentIntent({
        property: prepared.property,
        amount: Number(prepared.grandTotal),
        orderId: body.orderId,
        guestEmail: guestEmail || undefined,
      });
      intent = {
        bookingId: booking.id,
        clientSecret: pi.clientSecret,
        paymentIntentId: pi.paymentIntentId,
      };
    } else {
      const si = await createBookingSetupIntent({
        property: prepared.property,
        orderId: body.orderId,
        guestEmail: guestEmail || undefined,
        guestFirst: body.guestFirst,
        guestLast: body.guestLast,
      });
      intent = {
        bookingId: booking.id,
        clientSecret: si.clientSecret,
        setupIntentId: si.setupIntentId,
        customerId: si.customerId,
      };
    }
  } catch (err) {
    if (err instanceof StripeIntentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`init booking ${booking.id} intent create failed:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to initialise payment: ${message}` },
      { status: 502 }
    );
  }

  // Persist the intent ids on the row so the finalise/webhook/cron paths have
  // them even if the browser never sends them back.
  await db
    .update(bookings)
    .set({
      stripePaymentIntentId: intent.paymentIntentId ?? booking.stripePaymentIntentId ?? null,
      stripeSetupIntentId: intent.setupIntentId ?? booking.stripeSetupIntentId ?? null,
      stripeCustomerId: intent.customerId ?? booking.stripeCustomerId ?? null,
    })
    .where(eq(bookings.id, booking.id));

  return NextResponse.json(intent);
}
