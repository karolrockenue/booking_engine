import { NextRequest, NextResponse } from "next/server";
import {
  chargeBooking,
  findEligibleBookings,
} from "@/lib/stripe/auto-charge";
import {
  chargeRyftBooking,
  findEligibleRyftBookings,
} from "@/lib/ryft/auto-charge";

// Hourly auto-charge cron. Picks up Flex bookings whose cancellation window
// has closed and charges the saved card off-session — Stripe (off-session
// PaymentIntent) and Ryft (MIT against the saved card) sweeps run side by side,
// disambiguated by which rail's saved-card state the booking carries. On
// success each records the payment in the PMS folio.
//
// Bearer-protected with CRON_SECRET, same pattern as inventory-sync.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const provided = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    ""
  );
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [stripeEligible, ryftEligible] = await Promise.all([
      findEligibleBookings(),
      findEligibleRyftBookings(),
    ]);
    const summary = {
      eligible: stripeEligible.length + ryftEligible.length,
      charged: 0,
      failed: 0,
      skipped: 0,
      graceExpired: 0,
    };
    const results = [];
    const tally = (outcome: string) => {
      switch (outcome) {
        case "charged":
          summary.charged++;
          break;
        case "failed":
          summary.failed++;
          break;
        case "skipped":
          summary.skipped++;
          break;
        case "grace_expired":
          summary.graceExpired++;
          break;
      }
    };
    for (const booking of stripeEligible) {
      const result = await chargeBooking(booking);
      results.push(result);
      tally(result.outcome);
    }
    for (const booking of ryftEligible) {
      const result = await chargeRyftBooking(booking);
      results.push(result);
      tally(result.outcome);
    }
    console.log(
      JSON.stringify({
        event: "cron_heartbeat",
        cron: "auto-charge",
        at: new Date().toISOString(),
        ok: true,
        summary,
      })
    );
    return NextResponse.json({ ok: true, summary, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "cron_heartbeat",
        cron: "auto-charge",
        at: new Date().toISOString(),
        ok: false,
        error: message,
      })
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
