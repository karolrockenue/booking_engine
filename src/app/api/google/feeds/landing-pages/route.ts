import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { buildLandingPagesFeed } from "@/lib/google-hotels/landing-pages";

// Google Landing Pages (Point of Sale) feed (Sprint 4). Admin-gated for now.
// Bearer ADMIN_TOKEN required. This config is uploaded to Hotel Center once
// (it's static — a single templated URL), not pulled per-day like the price feed.
export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { xml } = buildLandingPagesFeed();

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
