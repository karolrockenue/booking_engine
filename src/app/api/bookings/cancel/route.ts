import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  bookings,
  bookingExtras,
  paymentEvents,
  properties,
  roomTypes,
  ratePlans,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyCancelToken } from "@/lib/crypto";
import { getPmsAdapter } from "@/lib/pms";
import {
  getPaymentSession,
  refundPaymentSession,
  voidPaymentSession,
  deletePaymentMethod,
} from "@/lib/ryft/sessions";
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
  // Cloudbeds needs a resolved property id; Mews cancels via its stored creds.
  if (!property || (property.pmsType !== "mews" && !property.cloudbedsPropertyId)) {
    return NextResponse.json(
      { outcome: "ineligible", reason: "no_reservation" } satisfies Outcome,
      { status: 409 }
    );
  }

  const pms = getPmsAdapter(property);

  // Cancel in the PMS first. If this fails, we abort — better to leave the
  // PMS reservation live than to detach the card and end up with a held room
  // with no way to charge.
  try {
    await pms.cancelReservation({
      reservationId: booking.cloudbedsReservationId,
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

  // Reverse the extras. Cancelling a reservation zeroes the room but leaves
  // posted extras (breakfast, early check-in, …) as charges, so the folio still
  // shows a balance due. The adapter handles the PMS-specific reversal: Cloudbeds
  // offsets each with a negative custom item; Mews cancels the product order's
  // items (orderItems/cancel). Non-fatal: a failed reversal is a reconciliation
  // issue, not a cancel failure.
  const charged = await db
    .select()
    .from(bookingExtras)
    .where(eq(bookingExtras.bookingId, booking.id));
  for (const ex of charged) {
    if (!ex.cloudbedsItemId) continue; // never reached the folio — nothing to reverse
    try {
      await pms.reverseExtra({
        reservationId: booking.cloudbedsReservationId,
        pmsItemId: ex.cloudbedsItemId,
        name: ex.name,
        unitPrice: Number(ex.unitPrice),
        quantity: ex.qty,
      });
    } catch (reverseErr) {
      console.error(
        `Failed to reverse extra "${ex.name}" on cancelled reservation ${booking.cloudbedsReservationId}:`,
        reverseErr
      );
    }
  }

  // Refund branch. A refundable Ryft booking with a payment session is refunded
  // when Captured, or voided when only Approved (authorised, no money settled
  // yet). A pre-charge Flex booking has no session — just a saved card — so we
  // delete the card; no money was taken.
  let refunded = false;
  let refundAmount: number | undefined;
  if (booking.ryftPaymentSessionId && property.ryftAccountId) {
    const account = property.ryftAccountId;
    const sessionId = booking.ryftPaymentSessionId;
    const refundCurrency = (
      property.ryftAccountCurrency ?? booking.currency
    ).toUpperCase();

    // Resolve the live session so we pick void (authorised) vs refund
    // (captured) correctly. A failed lookup leaves money un-reversed — logged,
    // not fatal (Cloudbeds is already cancelled; Karol reconciles in Ryft).
    const session = await getPaymentSession(sessionId, account).catch((err) => {
      console.error(
        `Ryft session lookup failed for booking ${booking.id} (session ${sessionId}):`,
        err
      );
      return null;
    });

    if (session?.status === "Captured") {
      try {
        const refund = await refundPaymentSession(sessionId, account, {
          reason: "requested_by_customer",
          // Return our platform fee too so the guest gets the full amount back.
          refundPlatformFee: true,
        });
        refunded = true;
        refundAmount = Number(booking.grandTotal);
        await db.insert(paymentEvents).values({
          bookingId: booking.id,
          type: "refund",
          ryftId: refund.id,
          amount: refundAmount.toFixed(2),
          currency: refundCurrency,
          status: refund.status ?? "Refunded",
          payload: refund as unknown as Record<string, unknown>,
        });

        // §7.4: cancelling zeroes the room but leaves the recorded external
        // payment on the folio, so it still reads as paid. Post a compensating
        // reversal so the folio reconciles to Ryft. Non-fatal (Cloudbeds
        // no-ops and returns null today).
        try {
          const reversal = await pms.recordRefund({
            reservationId: booking.cloudbedsReservationId,
            amount: refundAmount,
            externalIdentifier: refund.id,
            description: `Ryft refund ${refund.id}`,
          });
          if (reversal) {
            await db.insert(paymentEvents).values({
              bookingId: booking.id,
              type: "pms_refund_recorded",
              ryftId: refund.id,
              amount: refundAmount.toFixed(2),
              currency: refundCurrency,
              status: "recorded",
            });
          }
        } catch (reversalErr) {
          console.error(
            `Compensating PMS reversal failed for booking ${booking.id} (reservation ${booking.cloudbedsReservationId}):`,
            reversalErr
          );
          await db.insert(paymentEvents).values({
            bookingId: booking.id,
            type: "pms_refund_failed",
            ryftId: refund.id,
            status: "pms_reversal_failed",
            errorMessage:
              reversalErr instanceof Error ? reversalErr.message : "Unknown",
          });
        }
      } catch (refundErr) {
        console.error(
          `Ryft refund failed for booking ${booking.id} (session ${sessionId}):`,
          refundErr
        );
        // Cloudbeds is already cancelled; refund failure is manual-recovery
        // (Karol refunds from the Ryft dashboard). Carry on so the status
        // reflects reality — guest sees "cancelled, refund pending".
        await db.insert(paymentEvents).values({
          bookingId: booking.id,
          type: "auto_charge_failed",
          status: "refund_failed",
          errorMessage:
            refundErr instanceof Error ? refundErr.message : "Unknown",
        });
      }
    } else if (session?.status === "Approved") {
      // Authorised but not captured — void it. No money settled, so there's no
      // folio payment to reverse.
      try {
        const voided = await voidPaymentSession(sessionId, account);
        await db.insert(paymentEvents).values({
          bookingId: booking.id,
          type: "payment_session_voided",
          ryftId: voided.id,
          status: voided.status ?? "Voided",
          payload: voided as unknown as Record<string, unknown>,
        });
      } catch (voidErr) {
        console.error(
          `Ryft void failed for booking ${booking.id} (session ${sessionId}):`,
          voidErr
        );
        await db.insert(paymentEvents).values({
          bookingId: booking.id,
          type: "auto_charge_failed",
          status: "void_failed",
          errorMessage:
            voidErr instanceof Error ? voidErr.message : "Unknown",
        });
      }
    }
    // else: nothing captured/authorised (e.g. PendingPayment) → no charge to
    // reverse, nothing to do.
  } else if (booking.ryftPaymentMethodId && property.ryftAccountId) {
    // Flex pre-charge: no payment session yet (no money taken), just a saved
    // card. Delete it so the auto-charge cron can never charge it. Best-effort —
    // a single-use or already-gone card just throws.
    await deletePaymentMethod(
      booking.ryftPaymentMethodId,
      property.ryftAccountId
    ).catch((err) =>
      console.error(
        `Delete saved card failed for booking ${booking.id} (pm ${booking.ryftPaymentMethodId}):`,
        err
      )
    );
    await db.insert(paymentEvents).values({
      bookingId: booking.id,
      type: "payment_method_detached",
      ryftId: booking.ryftPaymentMethodId,
      status: "deleted_on_cancel",
    });
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
