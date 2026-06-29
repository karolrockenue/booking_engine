// Verifies sweepAbandonedBookings() only marks genuinely-dead create-before-pay
// rows: old + pending + no reservation + no succeeded payment. Asserts it leaves
// recent rows, reserved rows, and paid-but-slow rows untouched. Self-cleaning.
//   set -a && source .env.local && set +a && npx tsx src/scripts/sweep-abandoned-smoke.ts
import { db } from "../db";
import { bookings, paymentEvents, properties } from "../db/schema";
import { inArray } from "drizzle-orm";
import { sweepAbandonedBookings } from "../lib/booking/sweep-abandoned";

let fail = false;
const check = (c: boolean, m: string) => {
  if (!c) {
    fail = true;
    console.log("❌ " + m);
  } else console.log("✓ " + m);
};

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago (past 24h TTL)
const NEW = new Date(); // now

(async () => {
  const [p] = await db.select().from(properties).limit(1);
  const base = {
    propertyId: p.id,
    roomTypeId: null,
    ratePlanId: null,
    checkIn: "2099-01-01",
    checkOut: "2099-01-03",
    guestFirst: "",
    guestLast: "",
    guestEmail: "sweep@example.com",
    roomTotal: "100.00",
    grandTotal: "100.00",
    currency: "GBP",
  };
  const mk = async (suffix: string, over: Record<string, unknown>) => {
    const [b] = await db
      .insert(bookings)
      .values({ ...base, orderId: `sweep-${suffix}-${Date.now()}`, ...over })
      .returning();
    return b;
  };

  // a) old + pending + no reservation + no payment  → SHOULD be swept
  const a = await mk("dead", { status: "pending", createdAt: OLD });
  // b) recent + pending                              → untouched (too young)
  const b = await mk("young", { status: "pending", createdAt: NEW });
  // c) old + pending + HAS reservation               → untouched (already synced-ish)
  const c = await mk("reserved", { status: "pending", createdAt: OLD, cloudbedsReservationId: "res-smoke" });
  // d) old + pending + succeeded payment event       → untouched (money taken, slow webhook)
  const d = await mk("paidslow", { status: "pending", createdAt: OLD });
  await db.insert(paymentEvents).values({
    bookingId: d.id,
    type: "payment_intent_succeeded",
    ryftId: "ps_sweep_smoke",
    amount: "100.00",
    currency: "gbp",
    status: "succeeded",
  });
  // e) old + already paid status                     → untouched (not pending)
  const e = await mk("paid", { status: "paid", createdAt: OLD });

  const ids = [a.id, b.id, c.id, d.id, e.id];
  const res = await sweepAbandonedBookings(24);
  check(res.abandoned >= 1 && res.ids.includes(a.id), `swept the dead row (abandoned=${res.abandoned})`);

  const rows = await db.select().from(bookings).where(inArray(bookings.id, ids));
  const st = (id: string) => rows.find((r) => r.id === id)!.status;
  check(st(a.id) === "abandoned", "a) dead pending row → abandoned");
  check(st(b.id) === "pending", "b) recent pending row → untouched");
  check(st(c.id) === "pending", "c) reserved pending row → untouched");
  check(st(d.id) === "pending", "d) paid-but-slow pending row → untouched (money taken)");
  check(st(e.id) === "paid", "e) already-paid row → untouched");

  // cleanup
  await db.delete(paymentEvents).where(inArray(paymentEvents.bookingId, ids));
  await db.delete(bookings).where(inArray(bookings.id, ids));

  console.log(fail ? "\n❌ FAIL" : "\n✅ PASS — abandoned sweep is correctly conservative");
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("CRASHED:", e);
  process.exit(1);
});
