import { NextRequest, NextResponse } from "next/server";
import { syncInventoryForAllConnectedProperties } from "@/lib/cloudbeds/sync-inventory";

// Triggered by Railway cron every 6 hours. Authenticated by a shared bearer
// token (CRON_SECRET) — Railway cron jobs send the secret via the Authorization
// header. The route must complete within Railway's request timeout, which is
// fine for ~20 properties × ~30s sync each = 10min worst case (we'll need to
// move to a background job once we hit that scale, but not now).
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
    const results = await syncInventoryForAllConnectedProperties(90);
    const totals = results.reduce(
      (acc, r) => ({
        properties: acc.properties + 1,
        roomTypes: acc.roomTypes + r.roomTypesUpserted,
        ratePlans: acc.ratePlans + r.ratePlansUpserted,
        inventoryRows: acc.inventoryRows + r.inventoryRowsUpserted,
      }),
      { properties: 0, roomTypes: 0, ratePlans: 0, inventoryRows: 0 }
    );
    return NextResponse.json({ ok: true, totals, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Cron inventory-sync failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
