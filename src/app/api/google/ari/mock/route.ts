import { NextRequest, NextResponse } from "next/server";

// Mock Google ARI endpoint (Sprint 5). Stands in for Google's real ingestion
// endpoint until we're allowlisted, so the full generate → POST → log loop runs
// end-to-end offline. Accepts any XML body, logs its size, returns 200 like
// Google would. Swap GOOGLE_ARI_ENDPOINT to the real URL to go live.
export async function POST(req: NextRequest) {
  const body = await req.text();
  console.log(
    JSON.stringify({
      event: "google_ari_mock_received",
      bytes: body.length,
      at: new Date().toISOString(),
    })
  );
  return NextResponse.json({ ok: true, received: body.length });
}
