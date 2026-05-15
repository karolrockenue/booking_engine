import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, paymentEvents, properties, roomTypes, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyCancelToken } from "@/lib/crypto";
import { putReservationStatus } from "@/lib/cloudbeds/reservations";
import { detachPaymentMethod } from "@/lib/stripe/detach";
import { getStripe } from "@/lib/stripe/client";
import { sendBookingCancellationEmail } from "@/lib/email/booking-cancellation";

interface CancelRequestBody {
  token: string;
}

interface CancellationPolicySnapshot {
  deadlineHours?: number;
  penaltyType?: "first_night" | "full_stay" | "percent" | "none";
  penaltyPercent?: number;
  isRefundable?: boolean;
  note?: string;
}

type Outcome =
  | { outcome: "cancelled"; refunded: boolean; refundAmount?: number }
  | { outcome: "already_cancelled" }
  | { outcome: "ineligible"; reason: IneligibleReason; deadlineAt?: string };

type IneligibleReason =
  | "non_refundable"
  | "past_deadline"
  | "already_charged_no_refund"
  | "no_reservation"
  | "invalid_status";

// Compute the cancellation deadline from the snapshot. Returns null if the
// booking is non-refundable (no deadline applies — guest just can't cancel
// for a refund) or if the snapshot has no deadlineHours configured.
function computeDeadline(
  checkIn: string,
  policy: CancellationPolicySnapshot
): Date | null {
  if (policy.isRefundable === false) return null;
  if (typeof policy.deadlineHours !== "number") return null;
  const checkInDate = new Date(`${checkIn}T00:00:00Z`);
  return new Date(checkInDate.getTime() - policy.deadlineHours * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CancelRequestBody | null;
  if (!body?.token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const verified = verifyCancelToken(body.token);
  if (!verified) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, verified.bookingId))
    .limit(1);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Idempotent: if already cancelled, return success with the same shape so
  // the page can render the cancelled state regardless of how we got here.
  if (booking.status === "cancelled") {
    return NextResponse.json({ outcome: "already_cancelled" } satisfies Outcome);
  }

  // Sanity: booking must have synced to Cloudbeds before it can be cancelled.
  // 'pending' means we never even started; 'failed' means terminal earlier
  // failure; both are admin-only states.
  if (booking.status !== "pms_synced" && booking.status !== "paid" && booking.status !== "payment_authorized") {
    return NextResponse.json(
      { outcome: "ineligible", reason: "invalid_status" } satisfies Outcome,
      { status: 409 }
    );
  }

  if (!booking.cloudbedsReservationId) {
    return NextResponse.json(
      { outcome: "ineligible", reason: "no_reservation" } satisfies Outcome,
      { status: 409 }
    );
  }

  const policy = (booking.cancellationPolicySnapshot ?? {}) as CancellationPolicySnapshot;

  // Non-refundable bookings: the guest could in principle still cancel the
  // PMS side (free up the room) and forfeit the money. v1 doesn't expose
  // that — punt to "contact hotel" so the hotel chooses the outcome.
  if (booking.rateType === "nr" || policy.isRefundable === false) {
    return NextResponse.json(
      { outcome: "ineligible", reason: "non_refundable" } satisfies Outcome,
      { status: 409 }
    );
  }

  // Deadline check. If past the cutoff, punt to "contact hotel" — the policy
  // says a penalty applies and v1 doesn't compute / charge penalties.
  const deadlineAt = computeDeadline(booking.checkIn, policy);
  if (deadlineAt && Date.now() > deadlineAt.getTime()) {
    return NextResponse.json(
      {
        outcome: "ineligible",
        reason: "past_deadline",
        deadlineAt: deadlineAt.toISOString(),
      } satisfies Outcome,
      { status: 409 }
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId!))
    .limit(1);
  if (!property?.cloudbedsPropertyId) {
    return NextResponse.json(
      { outcome: "ineligible", reason: "no_reservation" } satisfies Outcome,
      { status: 409 }
    );
  }

  // Cancel in Cloudbeds first. If this fails, we abort — better to leave the
  // PMS reservation live than to detach the card and end up with a held room
  // with no way to charge.
  try {
    await putReservationStatus(booking.propertyId!, {
      cloudbedsPropertyId: property.cloudbedsPropertyId,
      reservationID: booking.cloudbedsReservationId,
      status: "canceled",
      reason: "guest_self_cancel",
    });
  } catch (err) {
    console.error(
      `Cancel failed at Cloudbeds for booking ${booking.id} (reservation ${booking.cloudbedsReservationId}):`,
      err
    );
    return NextResponse.json(
      { error: "Could not cancel reservation. Please contact the hotel." },
      { status: 502 }
    );
  }

  // Refund branch: Flex bookings that already auto-charged (status = 'paid'
  // before cancellation) get a Stripe refund. Pre-charge Flex (still
  // 'payment_authorized' or 'pms_synced' with a SetupIntent) just detaches
  // the saved card — no money was taken.
  let refunded = false;
  let refundAmount: number | undefined;
  if (booking.status === "paid" && booking.stripePaymentIntentId) {
    try {
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        reason: "requested_by_customer",
        // Refund the application fee too — guest gets the full amount back.
        refund_application_fee: true,
        reverse_transfer: true,
        metadata: { bookingId: booking.id, orderId: booking.orderId },
      });
      refunded = true;
      refundAmount = refund.amount / 100;
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "refund",
        stripeId: refund.id,
        amount: refundAmount.toFixed(2),
        currency: refund.currency.toUpperCase(),
        status: refund.status ?? "pending",
        payload: refund as unknown as Record<string, unknown>,
      });
    } catch (refundErr) {
      console.error(
        `Stripe refund failed for booking ${booking.id} (PI ${booking.stripePaymentIntentId}):`,
        refundErr
      );
      // Cloudbeds is already cancelled; refund failure is a manual-recovery
      // problem (Karol issues from Stripe dashboard). Carry on so the booking
      // status reflects reality — guest sees "cancelled, refund pending".
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "auto_charge_failed",
        status: "refund_failed",
        errorMessage: refundErr instanceof Error ? refundErr.message : "Unknown",
      });
    }
  } else if (booking.stripePaymentMethodId) {
    // Flex pre-charge: detach the saved card so it can't be charged later.
    const result = await detachPaymentMethod(booking.stripePaymentMethodId).catch(
      (err) => {
        console.error(
          `Detach PM failed for booking ${booking.id} (PM ${booking.stripePaymentMethodId}):`,
          err
        );
        return null;
      }
    );
    if (result) {
      await db.insert(paymentEvents).values({
        bookingId: booking.id,
        type: "payment_method_detached",
        stripeId: booking.stripePaymentMethodId,
        status: result.alreadyDetached ? "already_detached" : "detached",
      });
    }
  }

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, booking.id));

  // Fire-and-forget cancellation email. Booking is already cancelled in CB +
  // DB; a failed send is a customer-service problem, not a cancel-failure.
  void (async () => {
    const [room] = booking.roomTypeId
      ? await db.select().from(roomTypes).where(eq(roomTypes.id, booking.roomTypeId)).limit(1)
      : [undefined];
    const [ratePlan] = booking.ratePlanId
      ? await db.select().from(ratePlans).where(eq(ratePlans.id, booking.ratePlanId)).limit(1)
      : [undefined];
    try {
      await sendBookingCancellationEmail({
        propertyId: property.id,
        bookingId: booking.id,
        to: booking.guestEmail,
        guestFirstName: booking.guestFirst,
        guestLastName: booking.guestLast,
        hotelName: property.name,
        cloudbedsReservationId: booking.cloudbedsReservationId!,
        orderId: booking.orderId,
        roomName: room?.name ?? "Room",
        rateName: ratePlan?.name ?? "Rate",
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        currency: booking.currency,
        refunded,
        refundAmount,
      });
    } catch (emailErr) {
      console.error(`Cancellation email failed for booking ${booking.id}:`, emailErr);
    }
  })();

  return NextResponse.json({
    outcome: "cancelled",
    refunded,
    refundAmount,
  } satisfies Outcome);
}
