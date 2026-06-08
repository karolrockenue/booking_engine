import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  handleMewsWebhookEvents,
  type MewsWebhookPayload,
} from "@/lib/pms/mews/webhooks";

function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

// Mews General Webhooks are not signed (no HMAC, no signature header, no IP
// allow-list — confirmed in the integration plan §9). Security mirrors the
// Cloudbeds webhook route:
// 1. URL obscurity — the [token] segment is a random secret in
//    MEWS_WEBHOOK_TOKEN. Wrong token → 404 (looks like a missing route).
// 2. EnterpriseId cross-check inside the handler — an event only does work if
//    its EnterpriseId maps to a connected Mews property.
// 3. Idempotent sync — replaying a payload just re-syncs; no harm done.
//
// Mews enforces a ~5s SLA and discards messages after repeated failures, so we
// ack immediately and let the re-sync run fire-and-forget inside the handler.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const expected = process.env.MEWS_WEBHOOK_TOKEN;
  if (!expected || !tokenMatches(token, expected)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let payload: MewsWebhookPayload;
  try {
    payload = (await req.json()) as MewsWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const summary = await handleMewsWebhookEvents(payload);
  return NextResponse.json({ ok: true, ...summary });
}
