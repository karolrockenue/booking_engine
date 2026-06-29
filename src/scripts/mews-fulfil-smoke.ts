// Verifies the shared fulfilBooking() unit end-to-end through the real adapter
// on mews-demo-hotel: persist a booking + day-rates + extras intent, fulfil,
// assert reservation + extras + payment landed, then RE-RUN to prove idempotency
// (no double reservation / payment / email). Self-cleaning.
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-fulfil-smoke.ts
import { db } from "../db";
import { bookings, bookingDayRates, bookingExtras, properties, propertyExtras } from "../db/schema";
import { eq } from "drizzle-orm";
import { getPmsAdapter } from "../lib/pms";
import { fulfilBooking } from "../lib/pms/fulfil-booking";

(async () => {
  const [p] = await db.select().from(properties).where(eq(properties.slug, "mews-demo-hotel")).limit(1);
  const a = getPmsAdapter(p);
  await a.syncInventory(30);
  const ci = new Date(Date.now() + 18 * 864e5).toISOString().slice(0, 10);
  const co = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  const opt = (await a.getAvailability(ci, co, 1)).find((o) => o.totalPrice > 0)!;
  const [extra] = await db.select().from(propertyExtras).where(eq(propertyExtras.propertyId, p.id)).limit(1);
  let fail = false;
  const check = (c: boolean, m: string) => { if (!c) { fail = true; console.log("❌ " + m); } else console.log("✓ " + m); };

  // persist booking (NR/paid) + day-rates + a per-guest-per-night extra intent
  const orderId = `fulfil-${Date.now()}`;
  const [b] = await db.insert(bookings).values({
    propertyId: p.id, orderId, roomTypeId: opt.roomType.id, ratePlanId: opt.ratePlan.id,
    rateType: "nr", checkIn: ci, checkOut: co, adults: 1, children: 0,
    guestFirst: "Fulfil", guestLast: "Smoke", guestEmail: "fulfil-smoke@example.com", guestCountry: "GB",
    roomTotal: opt.totalPrice.toFixed(2), extrasTotal: (extra.priceMinorUnits/100).toFixed(2), grandTotal: (opt.totalPrice + extra.priceMinorUnits/100).toFixed(2),
    currency: "GBP", ryftPaymentSessionId: "ps_fulfil_smoke_fake", status: "paid",
  }).returning();
  await db.insert(bookingDayRates).values(opt.nightlyRates.map((n: any) => ({ bookingId: b.id, date: n.date, rate: n.rate.toFixed(2) })));
  await db.insert(bookingExtras).values({
    bookingId: b.id, name: extra.name, qty: 1, unitPrice: (extra.priceMinorUnits/100).toFixed(2),
    totalPrice: (extra.priceMinorUnits/100).toFixed(2), currency: extra.currency,
    propertyExtraId: extra.id, postingPlan: { model: "per_guest_per_night", perMorning: 1, mornings: [ci] },
  });

  // 1st fulfilment
  const r1 = await fulfilBooking(b.id);
  check(r1.outcome === "synced", `1st fulfil → synced (got ${r1.outcome})`);
  const [a1] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  check(!!a1.cloudbedsReservationId, "reservation id persisted");
  check(a1.status === "pms_synced", "status=pms_synced");
  check(!!a1.pmsPaymentId, "external payment recorded (pmsPaymentId set)");
  check(!!a1.confirmationEmailSentAt, "confirmation email slot claimed");
  const [ex1] = await db.select().from(bookingExtras).where(eq(bookingExtras.bookingId, b.id));
  check(!!ex1.cloudbedsItemId, `extra posted (orderId(s)=${ex1.cloudbedsItemId})`);
  const resId = a1.cloudbedsReservationId!, payId = a1.pmsPaymentId!, emailAt = a1.confirmationEmailSentAt;

  // 2nd fulfilment — must be idempotent
  const r2 = await fulfilBooking(b.id);
  check(r2.outcome === "synced", `2nd fulfil → synced (got ${r2.outcome})`);
  const [a2] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  check(a2.cloudbedsReservationId === resId, "no second reservation (same id)");
  check(a2.pmsPaymentId === payId, "no second payment (same id)");
  check(a2.confirmationEmailSentAt?.getTime() === emailAt?.getTime(), "email not re-sent (slot unchanged)");
  const [ex2] = await db.select().from(bookingExtras).where(eq(bookingExtras.bookingId, b.id));
  check(ex2.cloudbedsItemId === ex1.cloudbedsItemId, "extra not re-posted (same order id)");

  // cleanup: reverse extra + cancel reservation + delete rows
  try { if (ex2.cloudbedsItemId) await a.reverseExtra({ reservationId: resId, pmsItemId: ex2.cloudbedsItemId, name: extra.name, unitPrice: extra.priceMinorUnits/100, quantity: 1 }); } catch {}
  try { await a.cancelReservation({ reservationId: resId, reason: "fulfil smoke cleanup" }); } catch {}
  const { emailSends, paymentEvents } = await import("../db/schema");
  await db.delete(emailSends).where(eq(emailSends.bookingId, b.id));
  await db.delete(paymentEvents).where(eq(paymentEvents.bookingId, b.id));
  await db.delete(bookingExtras).where(eq(bookingExtras.bookingId, b.id));
  await db.delete(bookingDayRates).where(eq(bookingDayRates.bookingId, b.id));
  await db.delete(bookings).where(eq(bookings.id, b.id));

  console.log(fail ? "\n❌ FAIL" : "\n✅ PASS — fulfilBooking idempotent end-to-end");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CRASHED:", e); process.exit(1); });
