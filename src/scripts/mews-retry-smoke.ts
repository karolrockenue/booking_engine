// Write-recovery (pms-retry) verification for Mews, through the real
// retryPmsForBooking path. Proves the anti-double-book guard:
//
//   Test 1 — ADOPT: pre-create a Mews reservation (simulating an orphan from a
//            lost inline response), insert the matching stuck booking, run the
//            retry → it must ADOPT that reservation, not create a second one.
//   Test 2 — CREATE: a fresh stuck booking with no Mews reservation → retry
//            creates one, stores the id, advances status to pms_synced.
//   Test 3 — NO DOUBLE-BOOK: run the retry AGAIN on Test 2's stale snapshot
//            (id still null, as a duplicate/overlapping cron run would have) →
//            it must adopt the just-created reservation, returning the same id.
//   Test 4 — eligibility excludes synced bookings.
//
// Creates a throwaway Mews property, self-cleans (cancels reservations + deletes
// rows). Safe to re-run.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-retry-smoke.ts

import { db } from "../db";
import {
  properties,
  roomTypes,
  ratePlans,
  bookings,
  bookingDayRates,
  bookingExtras,
  paymentEvents,
  emailSends,
  mewsCategoryAvailability,
  mewsRatePrices,
  contentBlocks,
} from "../db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { getPmsAdapter } from "../lib/pms";
import { getMewsCredentials } from "../lib/pms/mews/credentials";
import { findEligibleBookings, retryPmsForBooking } from "../lib/pms/retry-pms";
import { mews, mewsPaginated } from "../lib/pms/mews/client";
import { toMewsUtc } from "../lib/pms/mews/timezone";

const SLUG = "mews-retry-smoke";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

type Creds = Awaited<ReturnType<typeof getMewsCredentials>>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Wait out Mews's read-after-write lag on reservations/getAll. In production the
// retry cron runs ≥60s after booking (MIN_BOOKING_AGE_SECONDS), well past this;
// the smoke creates and retries back-to-back, so we poll until the just-created
// reservation is findable before exercising the retry.
async function waitUntilFindable(
  adapter: ReturnType<typeof getPmsAdapter>,
  email: string,
  ci: string,
  co: string,
  cat: string,
  expectedId: string
): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    const hit = await adapter.findExistingReservation({
      orderId: "poll",
      startDate: ci,
      endDate: co,
      roomTypeId: cat,
      guestEmail: email,
    });
    if (hit?.pmsReservationId === expectedId) return true;
    await sleep(2500);
  }
  return false;
}

// Count non-cancelled Mews reservations matching this guest + stay + category.
async function countReservations(
  creds: Creds,
  email: string,
  startDate: string,
  endDate: string,
  categoryId: string
): Promise<number> {
  const startUtc = toMewsUtc(startDate, creds.timezone);
  const endUtc = toMewsUtc(endDate, creds.timezone);
  const startMs = new Date(startUtc).getTime();
  const windowStart = new Date(startMs - 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(startMs + 24 * 60 * 60 * 1000).toISOString();

  const customers = await mewsPaginated<{ Id?: string }>(
    "customers/getAll",
    creds.accessToken,
    { Emails: [email] },
    "Customers",
    100
  );
  const customerId = customers[0]?.Id;

  const rows = await mewsPaginated<{
    Id?: string;
    AccountId?: string;
    StartUtc?: string;
    EndUtc?: string;
    RequestedResourceCategoryId?: string;
  }>(
    "reservations/getAll/2023-06-06",
    creds.accessToken,
    {
      ServiceIds: [creds.serviceId],
      ScheduledStartUtc: { StartUtc: windowStart, EndUtc: windowEnd },
      States: ["Confirmed", "Started", "Processed"],
    },
    "Reservations",
    1000
  );
  const startMsTarget = new Date(startUtc).getTime();
  const endMsTarget = new Date(endUtc).getTime();
  const sameInstant = (a: string | undefined, ms: number) =>
    !!a && new Date(a).getTime() === ms;
  return rows.filter(
    (r) =>
      sameInstant(r.StartUtc, startMsTarget) &&
      sameInstant(r.EndUtc, endMsTarget) &&
      r.RequestedResourceCategoryId === categoryId &&
      (customerId ? r.AccountId === customerId : true)
  ).length;
}

async function cleanup(propertyId: string) {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.propertyId, propertyId));
  for (const b of rows) {
    await db.delete(bookingDayRates).where(eq(bookingDayRates.bookingId, b.id));
    await db.delete(bookingExtras).where(eq(bookingExtras.bookingId, b.id));
    await db.delete(paymentEvents).where(eq(paymentEvents.bookingId, b.id));
    await db.delete(emailSends).where(eq(emailSends.bookingId, b.id));
  }
  await db.delete(bookings).where(eq(bookings.propertyId, propertyId));
  await db.delete(mewsRatePrices).where(eq(mewsRatePrices.propertyId, propertyId));
  await db
    .delete(mewsCategoryAvailability)
    .where(eq(mewsCategoryAvailability.propertyId, propertyId));
  await db.delete(ratePlans).where(eq(ratePlans.propertyId, propertyId));
  await db.delete(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, propertyId));
  await db.delete(properties).where(eq(properties.id, propertyId));
}

async function insertStuckBooking(opts: {
  propertyId: string;
  orderId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  email: string;
  total: number;
  nightly: Array<{ date: string; rate: number }>;
  currency: string;
}) {
  const [booking] = await db
    .insert(bookings)
    .values({
      propertyId: opts.propertyId,
      orderId: opts.orderId,
      roomTypeId: opts.roomTypeId,
      ratePlanId: opts.ratePlanId,
      rateType: "nr",
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      adults: 1,
      children: 0,
      guestFirst: "Retry",
      guestLast: "Smoke",
      guestEmail: opts.email,
      guestCountry: "GB",
      roomTotal: opts.total.toFixed(2),
      extrasTotal: "0.00",
      grandTotal: opts.total.toFixed(2),
      currency: opts.currency,
      stripePaymentIntentId: `pi_retry_smoke_${Date.now()}`,
      // Backdate so the eligibility age filter (createdAt < now-60s) would pass.
      createdAt: new Date(Date.now() - 3600_000),
      status: "paid",
    })
    .returning();
  await db.insert(bookingDayRates).values(
    opts.nightly.map((n) => ({
      bookingId: booking.id,
      date: n.date,
      rate: n.rate.toFixed(2),
    }))
  );
  return booking;
}

async function main() {
  const token = process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  const [stale] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, SLUG))
    .limit(1);
  if (stale) await cleanup(stale.id);

  const info = await fetchMewsConnectionInfo(token);
  const service =
    info.services.find((s) => s.name === "Accommodation (real)") ?? info.services[0];
  if (!service) throw new Error("No Reservable service");

  const [property] = await db
    .insert(properties)
    .values({
      slug: SLUG,
      name: "Mews Retry Smoke",
      theme: {},
      pmsType: "mews",
      timezone: info.timezone || "Europe/London",
      currency: info.currency || "GBP",
      pmsCredentials: {
        accessTokenEnc: encryptToken(token),
        serviceId: service.id,
        timezone: info.timezone,
        enterpriseId: info.enterpriseId,
        taxMode: info.taxMode,
        externalPaymentType: info.externalPaymentTypes[0] ?? "Cash",
        currency: info.currency,
      },
    })
    .returning();
  const propertyId = property.id;
  const adapter = getPmsAdapter(property);
  const creds = await getMewsCredentials(propertyId);
  const reservationsToCancel: string[] = [];

  try {
    await adapter.syncInventory(40);
    const ci = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const co = new Date(Date.now() + 23 * 864e5).toISOString().slice(0, 10);
    const options = await adapter.getAvailability(ci, co, 1);

    // The shared demo's real-time availability is volatile, so pick the two
    // categories with the MOST headroom (min sellable units across the window)
    // and put each create-test in its own category — no contention, and high
    // headroom avoids a cache-says-1-but-Mews-says-0 false positive.
    const availForWindow = await db
      .select()
      .from(mewsCategoryAvailability)
      .where(
        and(
          eq(mewsCategoryAvailability.propertyId, propertyId),
          gte(mewsCategoryAvailability.date, ci),
          lt(mewsCategoryAvailability.date, co)
        )
      );
    const minUnits = new Map<string, number>();
    for (const r of availForWindow) {
      const cur = minUnits.get(r.categoryId);
      minUnits.set(
        r.categoryId,
        cur == null ? r.unitsAvailable : Math.min(cur, r.unitsAvailable)
      );
    }
    const firstPricedByCat = new Map<string, (typeof options)[number]>();
    for (const o of options) {
      if (o.totalPrice > 0 && !firstPricedByCat.has(o.roomType.otaRoomId)) {
        firstPricedByCat.set(o.roomType.otaRoomId, o);
      }
    }
    const candidates = [...firstPricedByCat.keys()]
      .filter((c) => (minUnits.get(c) ?? 0) >= 1)
      .sort((a, b) => (minUnits.get(b) ?? 0) - (minUnits.get(a) ?? 0));
    if (candidates.length < 2) {
      throw new Error("Need 2 bookable categories with headroom in this window");
    }
    const optA = firstPricedByCat.get(candidates[0])!;
    const optB = firstPricedByCat.get(candidates[1])!;
    const catA = optA.roomType.otaRoomId;
    const catB = optB.roomType.otaRoomId;
    console.log(
      `Test1 cat: ${optA.roomType.name} (units≥${minUnits.get(catA)}) · Test2 cat: ${optB.roomType.name} (units≥${minUnits.get(catB)})\n`
    );

    // ── Test 1: ADOPT an orphaned reservation ──────────────────────────────
    console.log("── Test 1: adopt orphaned reservation ──");
    const email1 = `retry1+${Date.now()}@example.com`;
    const orphan = await adapter.createReservation({
      startDate: ci,
      endDate: co,
      guestFirstName: "Retry",
      guestLastName: "Smoke",
      guestEmail: email1,
      guestCountry: "GB",
      roomTypeId: catA,
      rateId: optA.ratePlan.otaRateId,
      adults: 1,
      children: 0,
      roomSubtotal: optA.totalPrice,
      orderId: `retry-orphan-${Date.now()}`,
      nightlyRates: optA.nightlyRates,
    });
    reservationsToCancel.push(orphan.pmsReservationId);
    console.log(`  pre-created orphan reservation ${orphan.pmsReservationId}`);

    const findable1 = await waitUntilFindable(
      adapter,
      email1,
      ci,
      co,
      catA,
      orphan.pmsReservationId
    );
    check("orphan becomes findable via findExistingReservation", findable1);

    const booking1 = await insertStuckBooking({
      propertyId,
      orderId: `retry-booking1-${Date.now()}`,
      roomTypeId: optA.roomType.id,
      ratePlanId: optA.ratePlan.id,
      checkIn: ci,
      checkOut: co,
      email: email1,
      total: optA.totalPrice,
      nightly: optA.nightlyRates,
      currency: creds.currency,
    });
    const r1 = await retryPmsForBooking(booking1);
    check("retry outcome = synced", r1.outcome === "synced", JSON.stringify(r1));
    check(
      "adopted the orphan (same reservation id, no new booking)",
      r1.cloudbedsReservationId === orphan.pmsReservationId,
      `got ${r1.cloudbedsReservationId}, expected ${orphan.pmsReservationId}`
    );
    const count1 = await countReservations(creds, email1, ci, co, catA);
    check("exactly ONE reservation exists for the guest+stay", count1 === 1, `count=${count1}`);

    // ── Test 2: CREATE for a fresh stuck booking ───────────────────────────
    console.log("\n── Test 2: create for a fresh stuck booking ──");
    const email2 = `retry2+${Date.now()}@example.com`;
    const booking2 = await insertStuckBooking({
      propertyId,
      orderId: `retry-booking2-${Date.now()}`,
      roomTypeId: optB.roomType.id,
      ratePlanId: optB.ratePlan.id,
      checkIn: ci,
      checkOut: co,
      email: email2,
      total: optB.totalPrice,
      nightly: optB.nightlyRates,
      currency: creds.currency,
    });
    const r2 = await retryPmsForBooking(booking2);
    check("retry outcome = synced", r2.outcome === "synced", JSON.stringify(r2));
    check("created a reservation id", !!r2.cloudbedsReservationId);
    if (r2.cloudbedsReservationId) reservationsToCancel.push(r2.cloudbedsReservationId);
    const [synced2] = await db
      .select({ resId: bookings.cloudbedsReservationId, status: bookings.status, payId: bookings.pmsPaymentId })
      .from(bookings)
      .where(eq(bookings.id, booking2.id))
      .limit(1);
    check("booking row updated: status=pms_synced + id stored", synced2.status === "pms_synced" && !!synced2.resId);
    check("external payment recorded (pms_payment_id set)", !!synced2.payId, `payId=${synced2.payId}`);

    // ── Test 3: NO DOUBLE-BOOK on a duplicate/overlapping retry ────────────
    console.log("\n── Test 3: re-run retry on stale snapshot (no double-book) ──");
    // booking2 (the in-memory object) still has cloudbedsReservationId = null,
    // exactly what a second overlapping cron run would have seen. Wait out
    // read-after-write lag first (prod's ≥60s cadence covers this naturally).
    if (r2.cloudbedsReservationId) {
      const findable2 = await waitUntilFindable(
        adapter,
        email2,
        ci,
        co,
        catB,
        r2.cloudbedsReservationId
      );
      check("Test 2 reservation becomes findable before re-retry", findable2);
    }
    const r3 = await retryPmsForBooking(booking2);
    check("retry outcome = synced", r3.outcome === "synced", JSON.stringify(r3));
    check(
      "adopted the same reservation (no second booking)",
      r3.cloudbedsReservationId === r2.cloudbedsReservationId,
      `got ${r3.cloudbedsReservationId}, expected ${r2.cloudbedsReservationId}`
    );
    const count2 = await countReservations(creds, email2, ci, co, catB);
    check("still exactly ONE reservation for guest 2", count2 === 1, `count=${count2}`);

    // ── Test 4: eligibility excludes synced bookings ───────────────────────
    console.log("\n── Test 4: eligibility excludes synced bookings ──");
    const eligible = await findEligibleBookings();
    const ids = new Set(eligible.map((b) => b.id));
    check(
      "neither synced test booking is eligible for retry",
      !ids.has(booking1.id) && !ids.has(booking2.id)
    );
  } finally {
    for (const rid of reservationsToCancel) {
      await adapter
        .cancelReservation({ reservationId: rid, reason: "retry smoke cleanup" })
        .catch((e) => console.error(`cancel ${rid} failed:`, e instanceof Error ? e.message : e));
    }
    await cleanup(propertyId);
    console.log("\nCleaned up.");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nSMOKE FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
