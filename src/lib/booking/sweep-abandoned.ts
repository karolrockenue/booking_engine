// Sweep abandoned create-before-pay rows (0b follow-up).
//
// init (POST /api/bookings/init) persists a booking at status "pending" the
// moment the guest types their email. If they never pay, that row lingers as
// "pending" forever. This sweep marks such rows "abandoned" so dashboards /
// queries that look at live bookings aren't polluted by dead carts.
//
// NON-DESTRUCTIVE on purpose: it only flips status (keeps the row for funnel
// analytics), and only when we're certain NO money was taken — the row is
// pending, has no PMS reservation, is older than the TTL, AND has no
// succeeded payment event. So a genuinely-paid row whose webhook was merely
// slow is never swept.

import { db } from "@/db";
import { bookings, paymentEvents } from "@/db/schema";
import { and, eq, isNull, lt, inArray, notInArray, sql } from "drizzle-orm";

const DEFAULT_TTL_HOURS = 24;

export interface SweepResult {
  scanned: number;
  abandoned: number;
  ids: string[];
}

export async function sweepAbandonedBookings(
  ttlHours: number = DEFAULT_TTL_HOURS
): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

  // Candidates: pending, never reserved, older than the TTL.
  const candidates = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.status, "pending"),
        isNull(bookings.cloudbedsReservationId),
        lt(bookings.createdAt, cutoff)
      )
    );
  if (candidates.length === 0) return { scanned: 0, abandoned: 0, ids: [] };

  const candidateIds = candidates.map((c) => c.id);

  // Exclude any candidate that has a succeeded payment/setup event — that means
  // money was taken (or a card saved) and the row is mid-fulfilment, not dead.
  const paid = await db
    .selectDistinct({ bookingId: paymentEvents.bookingId })
    .from(paymentEvents)
    .where(
      and(
        inArray(paymentEvents.bookingId, candidateIds),
        inArray(paymentEvents.type, [
          "payment_intent_succeeded",
          "setup_intent_succeeded",
        ])
      )
    );
  const paidIds = paid.map((p) => p.bookingId).filter((x): x is string => !!x);

  // Atomic, guarded flip: still pending at update time (so a concurrent
  // finalise/webhook that just advanced the row wins the race).
  const updated = await db
    .update(bookings)
    .set({ status: "abandoned" })
    .where(
      and(
        inArray(bookings.id, candidateIds),
        eq(bookings.status, "pending"),
        isNull(bookings.cloudbedsReservationId),
        paidIds.length > 0
          ? notInArray(bookings.id, paidIds)
          : sql`true`
      )
    )
    .returning({ id: bookings.id });

  return {
    scanned: candidateIds.length,
    abandoned: updated.length,
    ids: updated.map((u) => u.id),
  };
}
