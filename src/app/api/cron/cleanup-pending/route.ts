import { NextRequest, NextResponse } from "next/server";
import { sweepAbandonedBookings } from "@/lib/booking/sweep-abandoned";

// Abandoned-cart sweep (0b follow-up). Marks create-before-pay "pending" rows
// that never got paid as "abandoned" so they don't pollute live-booking views.
// Non-destructive (status flip only) and only touches rows with no succeeded
// payment — see sweep-abandoned.ts.
//
// Suggested schedule: hourly. Bearer-protected with CRON_SECRET, same pattern
// as pms-retry / inventory-sync.
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

  // Optional ?ttlHours= override (default 24h) for manual runs.
  const ttlParam = req.nextUrl.searchParams.get("ttlHours");
  const ttlHours = ttlParam ? Number(ttlParam) : undefined;
  if (ttlParam && (!Number.isFinite(ttlHours) || (ttlHours as number) <= 0)) {
    return NextResponse.json({ error: "invalid ttlHours" }, { status: 400 });
  }

  try {
    const result = await sweepAbandonedBookings(ttlHours);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("cleanup-pending sweep failed:", err);
    return NextResponse.json({ error: "sweep failed" }, { status: 500 });
  }
}
