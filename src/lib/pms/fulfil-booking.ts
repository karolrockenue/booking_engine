// Single idempotent fulfilment unit (Step 0, create-before-pay).
//
// The PMS side of a booking — create reservation → post folio extras → record
// the external payment → staff note → guest confirmation email → status — used
// to live inline in /api/bookings and (minus extras) in the retry cron. It now
// lives here so all THREE triggers run the exact same path:
//   1. /api/bookings — inline, the happy path (awaited; returns the reservation #)
//   2. the Stripe webhook — durable backstop if the browser never returns
//   3. cron/pms-retry — sweeps anything still unsynced, then gives up + unwinds
//
// Safety:
//  - Optimistic claim (bookings.fulfilmentLockedAt): only one caller fulfils a
//    booking at a time, so two triggers can't create two reservations. A stale
//    claim (crashed mid-run) is re-claimable after LOCK_STALE_MS.
//  - Every step is individually guarded (reservation id / pmsPaymentId / posted
//    item id / confirmationEmailSentAt), so a re-run only does what's missing.
//  - Anti-double-book: before creating we ask the adapter for an existing
//    reservation (Mews has no idempotency key) and adopt it if found.
//
// The booking row + day-rates + extras INTENT must already be persisted (by
// /api/bookings); this function reads them and talks to the PMS.

import { db } from "@/db";
import {
  bookings,
  bookingDayRates,
  bookingExtras,
  properties,
  ratePlans,
  roomTypes,
  propertyExtras,
} from "@/db/schema";
import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { getPmsAdapter } from "@/lib/pms";
import { PmsSoldOutError } from "@/lib/pms/errors";
import { sendBookingConfirmationEmail } from "@/lib/email/booking-confirmation";
import { signCancelToken } from "@/lib/crypto";
import { publicOrigin } from "@/lib/stripe/client";
import { format, parseISO } from "date-fns";

const LOCK_STALE_MS = 2 * 60 * 1000; // a claim older than this is abandoned

export type FulfilOutcome =
  | "synced" // reservation exists in the PMS (created or already there)
  | "locked" // another trigger holds the claim — caller backs off
  | "sold_out" // PMS refused (CheckOverbooking) — surfaced as 409 upstream
  | "failed";

export interface FulfilResult {
  bookingId: string;
  outcome: FulfilOutcome;
  pmsReservationId?: string;
  cancelUrl?: string;
  reason?: string;
}

interface PostingPlan {
  model?: string;
  perMorning?: number;
  mornings?: string[];
}

function fmtMorning(d: string): string {
  try {
    return format(parseISO(d), "EEE d MMM");
  } catch {
    return d;
  }
}

// Claim the booking for fulfilment. Returns true if we won the lock. Losers get
// `false` and must NOT proceed (another trigger is handling it).
async function claim(bookingId: string): Promise<boolean> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS);
  const rows = await db
    .update(bookings)
    .set({ fulfilmentLockedAt: now })
    .where(
      and(
        eq(bookings.id, bookingId),
        or(
          isNull(bookings.fulfilmentLockedAt),
          lt(bookings.fulfilmentLockedAt, staleBefore)
        )
      )
    )
    .returning({ id: bookings.id });
  return rows.length > 0;
}

async function releaseLock(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({ fulfilmentLockedAt: null })
    .where(eq(bookings.id, bookingId));
}

export async function fulfilBooking(bookingId: string): Promise<FulfilResult> {
  const won = await claim(bookingId);
  if (!won) return { bookingId, outcome: "locked" };

  try {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!booking) return { bookingId, outcome: "failed", reason: "not_found" };
    if (!booking.propertyId || !booking.roomTypeId || !booking.ratePlanId) {
      return { bookingId, outcome: "failed", reason: "missing_fk" };
    }

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, booking.propertyId))
      .limit(1);
    if (
      !property ||
      (property.pmsType !== "mews" && !property.cloudbedsPropertyId)
    ) {
      return { bookingId, outcome: "failed", reason: "property_not_connected" };
    }

    const [room] = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.id, booking.roomTypeId))
      .limit(1);
    const [rate] = await db
      .select()
      .from(ratePlans)
      .where(eq(ratePlans.id, booking.ratePlanId))
      .limit(1);
    if (!room || !rate) {
      return { bookingId, outcome: "failed", reason: "missing_room_or_rate" };
    }

    const pms = getPmsAdapter(property);

    // 1. Reservation (adopt-or-create, persist-first). Use the stored id if we
    //    already created one; else adopt an existing PMS reservation; else create.
    let pmsReservationId = booking.cloudbedsReservationId ?? undefined;
    if (!pmsReservationId) {
      const existing = await pms.findExistingReservation({
        orderId: booking.orderId,
        startDate: booking.checkIn,
        endDate: booking.checkOut,
        roomTypeId: room.otaRoomId,
        guestEmail: booking.guestEmail,
      });
      if (existing) {
        pmsReservationId = existing.pmsReservationId;
      } else {
        const dayRates = await db
          .select()
          .from(bookingDayRates)
          .where(eq(bookingDayRates.bookingId, booking.id))
          .orderBy(asc(bookingDayRates.date));
        const nightlyRates = dayRates.map((d) => ({
          date: d.date,
          rate: Number(d.rate),
        }));
        try {
          const created = await pms.createReservation({
            startDate: booking.checkIn,
            endDate: booking.checkOut,
            guestFirstName: booking.guestFirst,
            guestLastName: booking.guestLast,
            guestEmail: booking.guestEmail,
            guestCountry: booking.guestCountry ?? undefined,
            guestPhone: booking.guestPhone ?? undefined,
            roomTypeId: room.otaRoomId,
            rateId: rate.otaRateId,
            adults: booking.adults ?? 1,
            children: booking.children ?? 0,
            roomSubtotal: Number(booking.roomTotal),
            orderId: booking.orderId,
            nightlyRates: nightlyRates.length > 0 ? nightlyRates : undefined,
          });
          pmsReservationId = created.pmsReservationId;
        } catch (err) {
          if (err instanceof PmsSoldOutError) {
            return { bookingId, outcome: "sold_out", reason: err.message };
          }
          throw err;
        }
      }
      // Persist-first: store the id immediately so a crash here can't re-create.
      await db
        .update(bookings)
        .set({ cloudbedsReservationId: pmsReservationId, status: "pms_synced" })
        .where(eq(bookings.id, booking.id));
    } else if (booking.status !== "pms_synced") {
      await db
        .update(bookings)
        .set({ status: "pms_synced" })
        .where(eq(bookings.id, booking.id));
    }

    // 2. Folio extras (from persisted intent rows). Only post rows not yet
    //    posted (cloudbedsItemId null), so a re-run completes the rest.
    const extraRows = await db
      .select()
      .from(bookingExtras)
      .where(eq(bookingExtras.bookingId, booking.id));
    const noteLines: string[] = [];
    for (const ex of extraRows) {
      const plan = (ex.postingPlan ?? {}) as PostingPlan;
      // Per-guest-per-night gets a staff note line regardless of post success.
      if (plan.model === "per_guest_per_night" && plan.mornings?.length) {
        noteLines.push(
          `${ex.name}: ${plan.perMorning} guest${plan.perMorning === 1 ? "" : "s"} × ${plan.mornings
            .map(fmtMorning)
            .join(", ")} (${ex.qty} total)`
        );
      }
      if (ex.cloudbedsItemId) continue; // already posted

      // Resolve the catalogue row for the PMS product + service id (Mews).
      let otaExtraId: string | undefined;
      let pmsServiceId: string | undefined;
      if (ex.propertyExtraId) {
        const [cat] = await db
          .select({
            otaExtraId: propertyExtras.otaExtraId,
            pmsServiceId: propertyExtras.pmsServiceId,
          })
          .from(propertyExtras)
          .where(eq(propertyExtras.id, ex.propertyExtraId))
          .limit(1);
        otaExtraId = cat?.otaExtraId ?? undefined;
        pmsServiceId = cat?.pmsServiceId ?? undefined;
      }
      const unitPrice = Number(ex.unitPrice);

      try {
        if (plan.model === "per_guest_per_night" && plan.mornings?.length) {
          const perMorning = plan.perMorning ?? booking.adults ?? 1;
          const ids: string[] = [];
          for (const morning of plan.mornings) {
            const { pmsItemId } = await pms.postExtra({
              reservationId: pmsReservationId,
              name: ex.name,
              amount: unitPrice,
              quantity: perMorning,
              serviceDate: morning,
              otaExtraId,
              pmsServiceId,
            });
            if (pmsItemId) ids.push(pmsItemId);
          }
          if (ids.length > 0) {
            await db
              .update(bookingExtras)
              .set({ cloudbedsItemId: ids.join(","), pmsItemId: ids.join(",") })
              .where(eq(bookingExtras.id, ex.id));
          }
        } else {
          const { pmsItemId } = await pms.postExtra({
            reservationId: pmsReservationId,
            name: ex.name,
            amount: unitPrice,
            quantity: ex.qty,
            otaExtraId,
            pmsServiceId,
          });
          if (pmsItemId) {
            await db
              .update(bookingExtras)
              .set({ cloudbedsItemId: pmsItemId, pmsItemId })
              .where(eq(bookingExtras.id, ex.id));
          }
        }
      } catch (extraErr) {
        // Non-fatal: money's taken, a missing folio line is a reconciliation
        // issue. The row stays unposted and a later pass / the cron can retry.
        console.error(
          `fulfilBooking postExtra failed for "${ex.name}" on ${pmsReservationId}:`,
          extraErr
        );
      }
    }

    // 3. Staff note (Cloudbeds only — Mews is a documented no-op). Best-effort.
    if (noteLines.length > 0) {
      try {
        await pms.postReservationNote({
          reservationId: pmsReservationId,
          note: noteLines.join(" | "),
        });
      } catch (noteErr) {
        console.error(
          `fulfilBooking postReservationNote failed for ${pmsReservationId}:`,
          noteErr
        );
      }
    }

    // 4. Record the external payment for NR (paid at checkout). Flex records it
    //    later at auto-charge. Guarded by pmsPaymentId so a re-run can't double.
    //    Rail-agnostic: prefer the Ryft session id, fall back to the legacy
    //    Stripe PaymentIntent during the phased migration.
    const paymentRef = booking.ryftPaymentSessionId
      ? { id: booking.ryftPaymentSessionId, label: `Ryft ${booking.ryftPaymentSessionId}` }
      : booking.stripePaymentIntentId
        ? { id: booking.stripePaymentIntentId, label: `Stripe ${booking.stripePaymentIntentId}` }
        : null;
    if (booking.rateType === "nr" && paymentRef && !booking.pmsPaymentId) {
      try {
        const { pmsPaymentId } = await pms.recordPayment({
          reservationId: pmsReservationId,
          amount: Number(booking.grandTotal),
          type: "credit",
          description: paymentRef.label,
          externalIdentifier: paymentRef.id,
        });
        if (pmsPaymentId) {
          await db
            .update(bookings)
            .set({ pmsPaymentId })
            .where(eq(bookings.id, booking.id));
        }
      } catch (payErr) {
        console.error(
          `fulfilBooking recordPayment failed for ${pmsReservationId}:`,
          payErr
        );
      }
    }

    const cancelUrl =
      booking.rateType === "flex"
        ? `${publicOrigin()}/cancel/${signCancelToken(booking.id)}`
        : undefined;

    // 5. Guest confirmation email — exactly once (claim a send slot atomically).
    if (!booking.confirmationEmailSentAt) {
      const sendClaim = await db
        .update(bookings)
        .set({ confirmationEmailSentAt: new Date() })
        .where(
          and(
            eq(bookings.id, booking.id),
            isNull(bookings.confirmationEmailSentAt)
          )
        )
        .returning({ id: bookings.id });
      if (sendClaim.length > 0) {
        const nights = Math.round(
          (new Date(booking.checkOut).getTime() -
            new Date(booking.checkIn).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const emailExtras = extraRows.map((e) => ({
          name: e.name,
          quantity: e.qty,
          lineTotal: Number(e.totalPrice),
        }));
        // Fire-and-forget so the inline checkout response isn't blocked on
        // SendGrid. The slot is already claimed (so concurrent triggers won't
        // double-send); on send failure we release it so a later pass retries.
        const resId = pmsReservationId;
        void (async () => {
          try {
            await sendBookingConfirmationEmail({
              propertyId: property.id,
              bookingId: booking.id,
              to: booking.guestEmail,
              guestFirstName: booking.guestFirst,
              guestLastName: booking.guestLast,
              hotelName: property.name,
              cloudbedsReservationId: resId,
              orderId: booking.orderId,
              rateType: (booking.rateType as "flex" | "nr") ?? "flex",
              roomName: room.name,
              rateName: rate.name,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              nights,
              adults: booking.adults ?? 1,
              currency: booking.currency,
              roomTotal: Number(booking.roomTotal),
              extrasTotal: Number(booking.extrasTotal),
              grandTotal: Number(booking.grandTotal),
              extras: emailExtras,
              cancelUrl,
            });
          } catch (emailErr) {
            await db
              .update(bookings)
              .set({ confirmationEmailSentAt: null })
              .where(eq(bookings.id, booking.id));
            console.error(
              `fulfilBooking confirmation email failed for booking ${booking.id}:`,
              emailErr
            );
          }
        })();
      }
    }

    return {
      bookingId,
      outcome: "synced",
      pmsReservationId,
      cancelUrl,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`fulfilBooking failed for ${bookingId}: ${reason}`);
    return { bookingId, outcome: "failed", reason };
  } finally {
    await releaseLock(bookingId);
  }
}
