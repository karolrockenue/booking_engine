import { db } from "@/db";
import {
  bookings,
  paymentEvents,
  properties,
  ratePlans,
  roomTypes,
} from "@/db/schema";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { chargeSavedCard, deletePaymentMethod } from "@/lib/ryft/sessions";
import { RyftError, publicOrigin } from "@/lib/ryft/client";
import { getPmsAdapter } from "@/lib/pms";
import { sendBookingCancellationEmail } from "@/lib/email/booking-cancellation";
import { signPaymentUpdateToken } from "@/lib/crypto";
import { sendPaymentUpdateEmail } from "@/lib/email/payment-update";

// Ryft auto-charge — the Ryft analog of stripe/auto-charge.ts. Cron picks up
// Flex bookings whose cancellation window has closed (chargeAt <= now) and
// charges the saved card off-session via a Merchant-Initiated Transaction
// (paymentType: Unscheduled + previousPayment = the card-save mandate). Routes
// to the hotel sub-account with the platform fee + card-fee-to-hotel split,
// mirroring the NR pay-now path.
//
// On failure, firstAutoChargeFailureAt anchors a 24h grace window; the cron
// retries hourly inside it (transient declines often recover). After the
// window we unwind: cancel in the PMS, delete the saved card, mark cancelled,
// email the guest.
//
// Rail split: a Ryft Flex booking carries ryftCustomerId + ryftPaymentMethodId
// + ryftVerifySessionId and no stripe_* state, so the eligible query keys off
// ryftPaymentMethodId. The Stripe sweep excludes these (it requires
// stripeCustomerId), so the two crons never both pick up the same booking.

const GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;

type Booking = typeof bookings.$inferSelect;

export type RyftAutoChargeOutcome =
  | "charged"
  | "failed"
  | "skipped"
  | "grace_expired";

export interface RyftAutoChargeResult {
  bookingId: string;
  outcome: RyftAutoChargeOutcome;
  reason?: string;
  paymentSessionId?: string;
  errorCode?: string;
}

export async function findEligibleRyftBookings(): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.rateType, "flex"),
        eq(bookings.status, "pms_synced"),
        isNotNull(bookings.ryftPaymentMethodId),
        isNotNull(bookings.chargeAt),
        lte(bookings.chargeAt, sql`NOW()`)
      )
    )
    .limit(100);
}

export async function chargeRyftBooking(
  booking: Booking
): Promise<RyftAutoChargeResult> {
  // Grace window check first: once 24h has passed since the first failure we
  // stop charging and unwind the booking.
  if (
    booking.firstAutoChargeFailureAt &&
    Date.now() - booking.firstAutoChargeFailureAt.getTime() > GRACE_WINDOW_MS
  ) {
    return autoCancelAfterGrace(booking);
  }

  if (
    !booking.propertyId ||
    !booking.ryftCustomerId ||
    !booking.ryftPaymentMethodId ||
    !booking.ryftVerifySessionId ||
    !booking.cloudbedsReservationId
  ) {
    return {
      bookingId: booking.id,
      outcome: "skipped",
      reason: "missing_ryft_or_cb_state",
    };
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId))
    .limit(1);
  // Cloudbeds needs a resolved property id; Mews acts via its stored creds.
  if (
    !property?.ryftAccountId ||
    property.ryftAccountStatus !== "active" ||
    (property.pmsType !== "mews" && !property.cloudbedsPropertyId)
  ) {
    return {
      bookingId: booking.id,
      outcome: "skipped",
      reason: "property_not_connected",
    };
  }

  // Bump attempt counter before the call so a hang/crash doesn't leave it
  // un-incremented (which would mean infinite retries).
  const nextAttempt = (booking.autoChargeAttempts ?? 0) + 1;
  await db
    .update(bookings)
    .set({ autoChargeAttempts: nextAttempt })
    .where(eq(bookings.id, booking.id));

  const grandTotalNum = Number(booking.grandTotal);
  // Charge currency = settlement currency (ryftAccountCurrency), the same one
  // the card-save mandate used. booking.currency may have been flipped by the
  // Cloudbeds sync, so it isn't authoritative here.
  const chargeCurrency =
    property.ryftAccountCurrency ?? booking.currency;

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "auto_charge_attempt",
    amount: grandTotalNum.toFixed(2),
    currency: chargeCurrency,
    status: String(nextAttempt),
  });

  try {
    const session = await chargeSavedCard({
      property,
      amount: grandTotalNum,
      orderId: booking.orderId,
      customerId: booking.ryftCustomerId,
      paymentMethodId: booking.ryftPaymentMethodId,
      previousPaymentSessionId: booking.ryftVerifySessionId,
      guestEmail: booking.guestEmail,
    });

    if (session.status !== "Approved" && session.status !== "Captured") {
      // Declined / pending-action without throwing — surface as a soft failure
      // so the grace/retry path picks it up.
      throw new Error(`Ryft session status ${session.status}`);
    }

    // Record the charge in the PMS folio. Best-effort — money is at Ryft; a
    // missing folio line is a reconciliation issue the hotel can fix.
    let pmsPaymentId: string | null = null;
    try {
      ({ pmsPaymentId } = await getPmsAdapter(property).recordPayment({
        reservationId: booking.cloudbedsReservationId,
        amount: grandTotalNum,
        type: "credit",
        description: `Ryft ${session.id} (auto-charge)`,
        externalIdentifier: session.id,
      }));
    } catch (payErr) {
      console.error(
        `Ryft auto-charge postPayment failed for reservation ${booking.cloudbedsReservationId}:`,
        payErr
      );
    }

    await db
      .update(bookings)
      .set({
        status: "paid",
        ryftPaymentSessionId: session.id,
        ...(pmsPaymentId ? { pmsPaymentId } : {}),
      })
      .where(eq(bookings.id, booking.id));

    await db.insert(paymentEvents).values({
      bookingId: booking.id,
      type: "auto_charge_succeeded",
      ryftId: session.id,
      amount: grandTotalNum.toFixed(2),
      currency: chargeCurrency,
      status: session.status,
      payload: session as unknown as Record<string, unknown>,
    });

    return {
      bookingId: booking.id,
      outcome: "charged",
      paymentSessionId: session.id,
    };
  } catch (err) {
    const errorCode = err instanceof RyftError ? String(err.status) : "unknown";
    const errorMessage = err instanceof Error ? err.message : "Unknown";

    await db
      .update(bookings)
      .set({
        firstAutoChargeFailureAt: booking.firstAutoChargeFailureAt ?? new Date(),
      })
      .where(eq(bookings.id, booking.id));

    await db.insert(paymentEvents).values({
      bookingId: booking.id,
      type: "auto_charge_failed",
      amount: grandTotalNum.toFixed(2),
      currency: chargeCurrency,
      status: "failed",
      errorCode,
      errorMessage,
    });

    console.error(
      `Ryft auto-charge attempt ${nextAttempt} failed for booking ${booking.id}: ${errorCode} — ${errorMessage}`
    );

    // Email the guest a "re-enter your card" link on the FIRST failure (guarded
    // by the absence of a prior firstAutoChargeFailureAt at entry). A saved-card
    // MIT decline usually means the card needs replacing, so unlike the Stripe
    // path (which only mails on authentication_required) we send on any first
    // decline; the 24h grace keeps retrying the old card meanwhile.
    if (!booking.firstAutoChargeFailureAt) {
      void sendReEnterCardEmail(booking).catch((e) =>
        console.error(`Ryft re-enter-card email failed for booking ${booking.id}:`, e)
      );
    }

    return {
      bookingId: booking.id,
      outcome: "failed",
      reason: errorMessage,
      errorCode,
    };
  }
}

async function autoCancelAfterGrace(
  booking: Booking
): Promise<RyftAutoChargeResult> {
  if (!booking.propertyId || !booking.cloudbedsReservationId) {
    // Nothing to cancel in the PMS — still terminate so the cron stops picking
    // it up.
    await db
      .update(bookings)
      .set({ status: "cancelled" })
      .where(eq(bookings.id, booking.id));
    return {
      bookingId: booking.id,
      outcome: "grace_expired",
      reason: "no_cb_reservation",
    };
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, booking.propertyId))
    .limit(1);
  if (property?.pmsType !== "mews" && !property?.cloudbedsPropertyId) {
    return {
      bookingId: booking.id,
      outcome: "grace_expired",
      reason: "property_not_connected",
    };
  }

  // Cancel in the PMS first. If it fails, abort and let the next run retry —
  // better to leave the room held than to delete the card and strand the
  // reservation.
  try {
    await getPmsAdapter(property).cancelReservation({
      reservationId: booking.cloudbedsReservationId,
      reason: "auto_cancel_grace_expired",
    });
  } catch (err) {
    console.error(`Ryft auto-cancel CB failed for booking ${booking.id}:`, err);
    return {
      bookingId: booking.id,
      outcome: "grace_expired",
      reason: "cb_cancel_failed",
    };
  }

  // Delete the saved card so it can't be charged later. Best-effort.
  if (booking.ryftPaymentMethodId && property.ryftAccountId) {
    await deletePaymentMethod(
      booking.ryftPaymentMethodId,
      property.ryftAccountId
    ).catch((e) => {
      console.error(`Ryft auto-cancel card delete failed for booking ${booking.id}:`, e);
    });
    await db.insert(paymentEvents).values({
      bookingId: booking.id,
      type: "payment_method_detached",
      ryftId: booking.ryftPaymentMethodId,
      status: "deleted_after_grace",
    });
  }

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, booking.id));

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "auto_charge_failed",
    status: "auto_cancelled_after_grace",
  });

  // Fire-and-forget cancellation email. refunded: false — no charge succeeded.
  void (async () => {
    const [room] = booking.roomTypeId
      ? await db
          .select()
          .from(roomTypes)
          .where(eq(roomTypes.id, booking.roomTypeId))
          .limit(1)
      : [undefined];
    const [rate] = booking.ratePlanId
      ? await db
          .select()
          .from(ratePlans)
          .where(eq(ratePlans.id, booking.ratePlanId))
          .limit(1)
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
        rateName: rate?.name ?? "Rate",
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        currency: booking.currency,
        refunded: false,
      });
    } catch (emailErr) {
      console.error(`Ryft auto-cancel email failed for booking ${booking.id}:`, emailErr);
    }
  })();

  return {
    bookingId: booking.id,
    outcome: "grace_expired",
    reason: "cancelled_after_grace",
  };
}

// Mail the guest a signed link to the rail-aware /payment-update page, where a
// Ryft-active property renders the Ryft CardForm to re-save a card. Mirrors the
// Stripe path's sendReAuthEmail; the email template is rail-agnostic.
async function sendReEnterCardEmail(booking: Booking): Promise<void> {
  const [property] = booking.propertyId
    ? await db
        .select()
        .from(properties)
        .where(eq(properties.id, booking.propertyId))
        .limit(1)
    : [];
  if (!property) return;

  const token = signPaymentUpdateToken(booking.id);
  await sendPaymentUpdateEmail({
    to: booking.guestEmail,
    guestFirstName: booking.guestFirst,
    hotelName: property.name,
    cloudbedsReservationId: booking.cloudbedsReservationId ?? booking.orderId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    currency: booking.currency,
    grandTotal: Number(booking.grandTotal),
    paymentUpdateUrl: `${publicOrigin()}/payment-update/${token}`,
  });

  await db.insert(paymentEvents).values({
    bookingId: booking.id,
    type: "auto_charge_failed",
    status: "re_auth_email_sent",
  });
}
