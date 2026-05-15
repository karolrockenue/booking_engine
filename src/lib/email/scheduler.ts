import { db } from "@/db";
import {
  bookings,
  emailSchedules,
  emailSends,
  properties as propertiesTable,
  roomTypes,
  ratePlans,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

import { sendTemplate } from "./send-template";
import type { VariableContext } from "./variables";
import { signCancelToken } from "@/lib/crypto";
import { publicOrigin } from "@/lib/stripe/client";

// Returns YYYY-MM-DD in the given timezone for `at`.
function dateInTz(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

// Returns HH (00-23) in the given timezone.
function hourInTz(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(at).padStart(2, "0");
}

// Add `days` to an ISO date string (YYYY-MM-DD). Pure string math; no TZ.
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function symbolFor(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

interface RunResult {
  inspected: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{
    propertyId: string;
    bookingId: string;
    templateKey: string;
    outcome: "sent" | "skipped" | "failed";
    reason?: string;
  }>;
}

// Walk every enabled schedule, find matching bookings for the current hour, and
// dispatch via sendTemplate. Idempotent — every send is logged to email_sends
// keyed by (bookingId, templateKey); duplicates are skipped here.
//
// When propertyId is set, only that property's schedules run (useful for tests).
// `at` defaults to now; pass a fixed Date for smoke tests.
export async function runEmailSchedules(
  opts: { at?: Date; propertyId?: string } = {}
): Promise<RunResult> {
  const at = opts.at ?? new Date();

  const allProps = await db.select().from(propertiesTable);
  const props = opts.propertyId
    ? allProps.filter((p) => p.id === opts.propertyId)
    : allProps;

  const result: RunResult = {
    inspected: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const property of props) {
    const tz = property.timezone ?? "UTC";
    const todayInTz = dateInTz(at, tz);
    const hourNow = hourInTz(at, tz);

    const schedules = await db
      .select()
      .from(emailSchedules)
      .where(
        and(
          eq(emailSchedules.propertyId, property.id),
          eq(emailSchedules.enabled, true)
        )
      );

    for (const sched of schedules) {
      // Match by hour only. Schedule timeOfDay is "HH:MM" in property TZ;
      // we compare the HH part to the current hour in that TZ.
      const schedHour = sched.timeOfDay.slice(0, 2);
      if (schedHour !== hourNow) continue;

      // Compute the booking-date that, after adding offsetDays, lands on today.
      // For trigger=arrival: bookingDate = today - offsetDays (so checkIn + offsetDays = today).
      // For trigger=checkout: bookingDate = today - offsetDays (checkOut + offsetDays = today).
      const targetDate = addDays(todayInTz, -sched.offsetDays);
      const dateCol = sched.trigger === "arrival" ? bookings.checkIn : bookings.checkOut;

      const candidates = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.propertyId, property.id),
            eq(dateCol, targetDate),
            inArray(bookings.status, ["paid", "pms_synced", "payment_authorized"])
          )
        );

      for (const booking of candidates) {
        result.inspected++;

        // Audience filter
        const nights = nightsBetween(booking.checkIn, booking.checkOut);
        if (
          (sched.audience === "flex" && booking.rateType !== "flex") ||
          (sched.audience === "nr" && booking.rateType !== "nr") ||
          (sched.audience === "min_nights_2" && nights < 2)
        ) {
          result.skipped++;
          result.details.push({
            propertyId: property.id,
            bookingId: booking.id,
            templateKey: sched.templateKey,
            outcome: "skipped",
            reason: "audience_filter",
          });
          continue;
        }

        // Idempotency: skip if this booking already received this template.
        const [already] = await db
          .select({ id: emailSends.id })
          .from(emailSends)
          .where(
            and(
              eq(emailSends.bookingId, booking.id),
              eq(emailSends.templateKey, sched.templateKey)
            )
          )
          .limit(1);
        if (already) {
          result.skipped++;
          result.details.push({
            propertyId: property.id,
            bookingId: booking.id,
            templateKey: sched.templateKey,
            outcome: "skipped",
            reason: "already_sent",
          });
          continue;
        }

        // Resolve room + rate plan for variables.
        const [room] = booking.roomTypeId
          ? await db
              .select()
              .from(roomTypes)
              .where(eq(roomTypes.id, booking.roomTypeId))
              .limit(1)
          : [undefined];
        const [ratePlan] = booking.ratePlanId
          ? await db
              .select()
              .from(ratePlans)
              .where(eq(ratePlans.id, booking.ratePlanId))
              .limit(1)
          : [undefined];

        const cancelUrl =
          booking.rateType === "flex"
            ? `${publicOrigin()}/cancel/${signCancelToken(booking.id)}`
            : undefined;

        const grand = Number(booking.grandTotal);
        const roomT = Number(booking.roomTotal);
        const extrasT = Number(booking.extrasTotal);

        const vars: VariableContext = {
          guest: {
            firstName: booking.guestFirst,
            lastName: booking.guestLast,
            email: booking.guestEmail,
          },
          booking: {
            reservationId: booking.cloudbedsReservationId ?? booking.orderId,
            orderId: booking.orderId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights,
            adults: booking.adults ?? 1,
            children: booking.children ?? 0,
            roomName: room?.name ?? "Room",
            rateName: ratePlan?.name ?? "Rate",
            rateType: (booking.rateType as "flex" | "nr") ?? "flex",
            currency: booking.currency,
            symbol: symbolFor(booking.currency),
            grandTotal: isNaN(grand) ? 0 : grand,
            roomTotal: isNaN(roomT) ? 0 : roomT,
            extrasTotal: isNaN(extrasT) ? 0 : extrasT,
          },
          property: {
            name: property.name,
            address: "",
            phone: "",
            email: "",
          },
          links: { cancel: cancelUrl },
        };

        try {
          const out = await sendTemplate({
            propertyId: property.id,
            templateKey: sched.templateKey,
            toEmail: booking.guestEmail,
            bookingId: booking.id,
            variables: vars,
          });
          if (out.status === "sent") {
            result.sent++;
            result.details.push({
              propertyId: property.id,
              bookingId: booking.id,
              templateKey: sched.templateKey,
              outcome: "sent",
            });
          } else {
            result.skipped++;
            result.details.push({
              propertyId: property.id,
              bookingId: booking.id,
              templateKey: sched.templateKey,
              outcome: "skipped",
              reason: out.reason,
            });
          }
        } catch (err) {
          result.failed++;
          const message = err instanceof Error ? err.message : String(err);
          result.details.push({
            propertyId: property.id,
            bookingId: booking.id,
            templateKey: sched.templateKey,
            outcome: "failed",
            reason: message,
          });
        }
      }
    }
  }

  return result;
}
