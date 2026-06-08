import { NextRequest, NextResponse } from "next/server";
import {
  findEligibleBookings,
  retryPmsForBooking,
} from "@/lib/pms/retry-pms";

// PMS recovery cron. Runs every 5 minutes. Picks up bookings where Stripe
// took the money (NR) or saved the card (Flex) but postReservation failed
// inline, retries the CB write, and gives up + unwinds payments after the
// MAX_ATTEMPTS window in retry-pms.ts.
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
      synced: 0,
      retryFailed: 0,
      gaveUp: 0,
    };
    const results = [];
    for (const booking of eligible) {
      const result = await retryPmsForBooking(booking);
      results.push(result);
      if (result.outcome === "synced") summary.synced++;
      else if (result.outcome === "gave_up") summary.gaveUp++;
      else summary.retryFailed++;
    }
    console.log(
      JSON.stringify({
        event: "cron_heartbeat",
        cron: "pms-retry",
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
        cron: "pms-retry",
        at: new Date().toISOString(),
        ok: false,
        error: message,
      })
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
