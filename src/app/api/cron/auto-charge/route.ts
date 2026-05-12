import { NextRequest, NextResponse } from "next/server";
import {
  chargeBooking,
  findEligibleBookings,
} from "@/lib/stripe/auto-charge";

// Hourly auto-charge cron. Picks up Flex bookings whose cancellation window
// has closed, creates an off-session PaymentIntent against the saved card,
// and on success records the payment in the Cloudbeds folio.
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
    const eligible = await findEligibleBookings();
    const summary = {
      eligible: eligible.length,
      charged: 0,
      failed: 0,
      skipped: 0,
      graceExpired: 0,
    };
    const results = [];
    for (const booking of eligible) {
      const result = await chargeBooking(booking);
      results.push(result);
      switch (result.outcome) {
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
