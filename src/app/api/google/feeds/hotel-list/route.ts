import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { buildHotelListFeed } from "@/lib/google-hotels/hotel-list-feed";

// Google Hotel List feed (Sprint 1). Admin-gated for now — not yet the public,
// BASIC-auth'd, zipped endpoint Google pulls (that's productionising, later).
// Bearer ADMIN_TOKEN required. Returns the raw XML; feed stats + per-property
// data gaps are surfaced in X-Feed-* response headers.
export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { xml, total, included, withWebsite, warnings } =
    await buildHotelListFeed();

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "X-Feed-Total": String(total),
      "X-Feed-Included": String(included),
      "X-Feed-With-Website": String(withWebsite),
      "X-Feed-Warnings": String(warnings.length),
    },
  });
}
