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
  createBookingPaymentSession,
  createBookingCardSave,
  RyftSessionError,
} from "@/lib/ryft/sessions";

// Ryft create-before-pay — the Ryft analog of /api/bookings/init. Persists the
// booking row (status "pending") + day-rates + extras intent, creates the Ryft
// session routed to the hotel sub-account, and stamps the session id(s) on the
// row so the webhook/fulfil path has them. Returns the clientSecret for the SDK.
//
// Two rate types:
//   - NR (pay-now): a capture-now session; stamps ryftPaymentSessionId.
//   - Flex (refundable): a zero-value card-save session (Credential-on-File
//     mandate); stamps ryftVerifySessionId + ryftCustomerId. The card is
//     charged off-session by the auto-charge cron once the cancel window closes.

interface InitBody {
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

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as InitBody;

  if (
    !body.propertyId ||
    !body.orderId ||
    !body.roomTypeId ||
    !body.ratePlanId ||
    !body.checkIn ||
    !body.checkOut ||
    body.totalPrice === undefined
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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

  const isFlex = prepared.rateType !== "nr";
  const guestEmail = body.guestEmail ?? "";

  // Idempotent on orderId: a re-fired init reuses the row and re-issues a
  // session rather than creating a duplicate booking.
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

  let session: {
    clientSecret: string;
    paymentSessionId: string;
    status: string;
    customerId?: string;
  };
  try {
    session = isFlex
      ? await createBookingCardSave({
          property: prepared.property,
          orderId: body.orderId,
          guestEmail: guestEmail || undefined,
          guestFirst: body.guestFirst,
          guestLast: body.guestLast,
        })
      : await createBookingPaymentSession({
          property: prepared.property,
          amount: Number(prepared.grandTotal),
          orderId: body.orderId,
          guestEmail: guestEmail || undefined,
        });
  } catch (err) {
    if (err instanceof RyftSessionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`ryft booking-init ${booking.id} session create failed:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to initialise payment: ${message}` },
      { status: 502 }
    );
  }

  // NR stamps the pay-now session; Flex stamps the card-save (COF mandate)
  // session + customer so the auto-charge cron can charge off-session later.
  await db
    .update(bookings)
    .set(
      isFlex
        ? {
            ryftVerifySessionId: session.paymentSessionId,
            ryftCustomerId: session.customerId,
          }
        : { ryftPaymentSessionId: session.paymentSessionId }
    )
    .where(eq(bookings.id, booking.id));

  return NextResponse.json({
    bookingId: booking.id,
    clientSecret: session.clientSecret,
    paymentSessionId: session.paymentSessionId,
    status: session.status,
    accountId: prepared.property.ryftAccountId,
    publicKey: process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY ?? null,
  });
}
