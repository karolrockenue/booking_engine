import { NextRequest, NextResponse } from "next/server";
import { runEmailSchedules } from "@/lib/email/scheduler";

// Triggered hourly by Railway cron. Authenticated by CRON_SECRET bearer.
// Walks every property's enabled email_schedules and dispatches sends for
// bookings whose trigger window matches the current hour in property TZ.

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const out = await runEmailSchedules();
    return NextResponse.json({
      ok: true,
      inspected: out.inspected,
      sent: out.sent,
      skipped: out.skipped,
      failed: out.failed,
      details: out.details,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Cron emails failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
