// Step 0b (create-before-pay) backend smoke, on mews-demo-hotel via the real
// adapter. Covers the three new server pieces that don't need a live browser /
// confirmed Stripe intent:
//   A. prepareBooking()    — the shared validation + price split + extras intent.
//   B. browser-death rescue (NR) — an init-shaped "pending" row (placeholder
//      names) gets its details patched, then the webhook rescue (real
//      rescueStuckBooking) flips it + fulfils it. Asserts the reservation uses
//      the PATCHED name and that a re-run is idempotent.
//   C. browser-death rescue (Flex) — asserts the rescue backfills the saved
//      payment method (the gap that would otherwise strand auto-charge) and
//      leaves the row in the state the auto-charge cron needs.
//   set -a && source .env.local && set +a && npx tsx src/scripts/bookings-init-smoke.ts
import { db } from "../db";
import {
  bookings,
  bookingDayRates,
  bookingExtras,
  properties,
  propertyExtras,
  emailSends,
  paymentEvents,
} from "../db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getPmsAdapter } from "../lib/pms";
import { prepareBooking } from "../lib/booking/prepare-booking";
import { rescueStuckBooking } from "../lib/stripe/rescue-booking";
import { fulfilBooking } from "../lib/pms/fulfil-booking";

let fail = false;
const check = (c: boolean, m: string) => {
  if (!c) {
    fail = true;
    console.log("❌ " + m);
  } else console.log("✓ " + m);
};

// A SetupIntent/PaymentIntent shaped just enough for rescueStuckBooking.
const fakeSI = (orderId: string) =>
  ({
    id: "seti_smoke_fake",
    object: "setup_intent",
    metadata: { orderId },
    payment_method: "pm_smoke_fake",
    customer: "cus_smoke_fake",
  }) as unknown as Stripe.SetupIntent;
const fakePI = (orderId: string) =>
  ({
    id: "pi_smoke_fake",
    object: "payment_intent",
    metadata: { orderId },
  }) as unknown as Stripe.PaymentIntent;

async function cleanup(id: string, adapter?: ReturnType<typeof getPmsAdapter>, resId?: string | null, itemId?: string | null, extraName?: string, unit?: number) {
  try {
    if (adapter && resId && itemId)
      await adapter.reverseExtra({ reservationId: resId, pmsItemId: itemId, name: extraName ?? "", unitPrice: unit ?? 0, quantity: 1 });
  } catch {}
  try {
    if (adapter && resId) await adapter.cancelReservation({ reservationId: resId, reason: "init smoke cleanup" });
  } catch {}
  await db.delete(emailSends).where(eq(emailSends.bookingId, id));
  await db.delete(paymentEvents).where(eq(paymentEvents.bookingId, id));
  await db.delete(bookingExtras).where(eq(bookingExtras.bookingId, id));
  await db.delete(bookingDayRates).where(eq(bookingDayRates.bookingId, id));
  await db.delete(bookings).where(eq(bookings.id, id));
}

(async () => {
  const [p] = await db.select().from(properties).where(eq(properties.slug, "mews-demo-hotel")).limit(1);
  const a = getPmsAdapter(p);
  await a.syncInventory(30);
  const ci = new Date(Date.now() + 26 * 864e5).toISOString().slice(0, 10);
  const co = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10);
  const opt = (await a.getAvailability(ci, co, 1)).find((o) => o.totalPrice > 0)!;
  const [extra] = await db.select().from(propertyExtras).where(eq(propertyExtras.propertyId, p.id)).limit(1);
  const extraMajor = extra.priceMinorUnits / 100;

  // ---- A. prepareBooking ----------------------------------------------------
  const prepared = await prepareBooking({
    propertyId: p.id,
    roomTypeId: opt.roomType.id,
    ratePlanId: opt.ratePlan.id,
    checkIn: ci,
    checkOut: co,
    adults: 1,
    children: 0,
    totalPrice: opt.totalPrice + extraMajor,
    currency: "GBP",
    extras: [{ id: extra.id, name: extra.name, priceMinorUnits: extra.priceMinorUnits, currency: extra.currency }],
  });
  check(prepared.rateType === (opt.ratePlan.isRefundable === false ? "nr" : "flex"), `prepare: rateType=${prepared.rateType}`);
  check(Math.abs(Number(prepared.roomTotal) - opt.totalPrice) < 0.01, `prepare: roomTotal split (${prepared.roomTotal})`);
  check(Math.abs(Number(prepared.extrasTotal) - extraMajor) < 0.01, `prepare: extrasTotal split (${prepared.extrasTotal})`);
  check(prepared.extraIntentRows.length === 1, "prepare: 1 extras-intent row built");
  check(Number(prepared.grandTotal) === Number((opt.totalPrice + extraMajor).toFixed(2)), `prepare: grandTotal (${prepared.grandTotal})`);

  // ---- B. browser-death rescue (NR) ----------------------------------------
  // Build an init-shaped row: pending + placeholder names + fake PI id, no
  // reservation. (We force NR regardless of the demo rate so we can assert the
  // external-payment recording too.)
  const orderB = `initsmoke-nr-${Date.now()}`;
  const [b] = await db
    .insert(bookings)
    .values({
      propertyId: p.id,
      orderId: orderB,
      roomTypeId: opt.roomType.id,
      ratePlanId: opt.ratePlan.id,
      rateType: "nr",
      checkIn: ci,
      checkOut: co,
      adults: 1,
      children: 0,
      guestFirst: "", // placeholder — init creates the row before the name is typed
      guestLast: "",
      guestEmail: "initsmoke@example.com",
      roomTotal: prepared.roomTotal,
      extrasTotal: prepared.extrasTotal,
      grandTotal: prepared.grandTotal,
      currency: "GBP",
      stripePaymentIntentId: "pi_smoke_fake",
      status: "pending",
      createdAt: new Date(), // recent → rescue age-gates the fulfil (assert the flip cleanly)
    })
    .returning();
  await db.insert(bookingDayRates).values(opt.nightlyRates.map((n: { date: string; rate: number }) => ({ bookingId: b.id, date: n.date, rate: n.rate.toFixed(2) })));
  await db.insert(bookingExtras).values(prepared.extraIntentRows.map((r) => ({ ...r, bookingId: b.id })));

  const [pre] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  check(pre.status === "pending" && !pre.cloudbedsReservationId, "NR: init row is pending with no reservation");

  // Simulate the details-patch (runs before the charge): real name lands.
  await db.update(bookings).set({ guestFirst: "Init", guestLast: "Smoke", guestCountry: "GB" }).where(eq(bookings.id, b.id));

  // Browser dies → finalise never runs. The Stripe webhook fires rescue. Row is
  // <60s old, so rescue backfills + flips status but age-gates the fulfilment
  // (won't race a possibly-still-running inline path).
  await rescueStuckBooking("payment", fakePI(orderB));
  const [flipped] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  check(flipped.status === "paid", `NR: rescue flipped pending→paid (got ${flipped.status})`);
  check(!flipped.cloudbedsReservationId, "NR: rescue age-gated the fulfil (no premature reservation)");

  // The cron / next webhook delivery then fulfils it — drive that deterministically.
  const r1 = await fulfilBooking(b.id);
  check(r1.outcome === "synced", `NR: fulfil → synced (got ${r1.outcome})`);
  const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  check(!!after.cloudbedsReservationId, "NR: reservation created");
  check(after.status === "pms_synced", `NR: status=pms_synced (got ${after.status})`);
  check(after.guestLast === "Smoke", "NR: reservation used the PATCHED name (not placeholder)");
  check(!!after.pmsPaymentId, "NR: external payment recorded");
  check(!!after.confirmationEmailSentAt, "NR: confirmation email claimed");
  const [exA] = await db.select().from(bookingExtras).where(eq(bookingExtras.bookingId, b.id));
  check(!!exA.cloudbedsItemId, "NR: extra posted to the folio");

  // Idempotency: a second fulfil must not double anything.
  const resId = after.cloudbedsReservationId!;
  const r2 = await fulfilBooking(b.id);
  check(r2.outcome === "synced", `NR: 2nd fulfil → synced (got ${r2.outcome})`);
  const [after2] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  check(after2.cloudbedsReservationId === resId, "NR: idempotent (no second reservation)");
  check(after2.pmsPaymentId === after.pmsPaymentId, "NR: idempotent (no second payment)");

  await cleanup(b.id, a, resId, exA.cloudbedsItemId, extra.name, extraMajor);

  // ---- C. browser-death rescue (Flex) — payment-method backfill ------------
  const orderC = `initsmoke-flex-${Date.now()}`;
  const [c] = await db
    .insert(bookings)
    .values({
      propertyId: p.id,
      orderId: orderC,
      roomTypeId: opt.roomType.id,
      ratePlanId: opt.ratePlan.id,
      rateType: "flex",
      checkIn: ci,
      checkOut: co,
      adults: 1,
      children: 0,
      guestFirst: "Flex",
      guestLast: "Smoke",
      guestEmail: "initsmoke-flex@example.com",
      guestCountry: "GB",
      roomTotal: prepared.roomTotal,
      extrasTotal: "0.00",
      grandTotal: prepared.roomTotal,
      currency: "GBP",
      stripeSetupIntentId: "seti_smoke_fake",
      // NOTE: no stripePaymentMethodId — the browser died before finalise sent it.
      status: "pending",
      createdAt: new Date(), // recent → assert the backfill+flip cleanly
    })
    .returning();
  await db.insert(bookingDayRates).values(opt.nightlyRates.map((n: { date: string; rate: number }) => ({ bookingId: c.id, date: n.date, rate: n.rate.toFixed(2) })));

  // The gap this closes: without the rescue backfilling the saved PM, the
  // auto-charge cron would skip this Flex booking forever (missing_stripe_state).
  await rescueStuckBooking("setup", fakeSI(orderC));
  const [cFlip] = await db.select().from(bookings).where(eq(bookings.id, c.id));
  check(cFlip.stripePaymentMethodId === "pm_smoke_fake", "Flex: rescue backfilled the saved payment method (auto-charge can now collect)");
  check(cFlip.stripeCustomerId === "cus_smoke_fake", "Flex: rescue backfilled the customer id");
  check(cFlip.status === "payment_authorized", `Flex: rescue flipped pending→payment_authorized (got ${cFlip.status})`);
  check(!cFlip.cloudbedsReservationId, "Flex: rescue age-gated the fulfil (no premature reservation)");

  // Drive the fulfil deterministically (cron / next webhook) and confirm Flex
  // creates the reservation but defers payment to the cutoff.
  const rc = await fulfilBooking(c.id);
  check(rc.outcome === "synced", `Flex: fulfil → synced (got ${rc.outcome})`);
  const [cAfter] = await db.select().from(bookings).where(eq(bookings.id, c.id));
  check(!!cAfter.cloudbedsReservationId, "Flex: reservation created");
  check(!cAfter.pmsPaymentId, "Flex: no external payment yet (charged later at cutoff)");

  await cleanup(c.id, a, cAfter.cloudbedsReservationId, null);

  console.log(fail ? "\n❌ FAIL" : "\n✅ PASS — create-before-pay (0b) backend verified");
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("CRASHED:", e);
  process.exit(1);
});
