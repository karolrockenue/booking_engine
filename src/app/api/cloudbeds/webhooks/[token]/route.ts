import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  handleCloudbedsWebhook,
  type WebhookPayload,
} from "@/lib/cloudbeds/webhook-handler";

function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

// Cloudbeds doesn't sign webhooks (confirmed via official docs — no signature
// header, no HMAC, no shared secret). Security relies on:
// 1. URL obscurity — the [token] segment is a 24-byte random hex value stored
//    in CLOUDBEDS_WEBHOOK_TOKEN. Wrong token → 404 (looks like a missing route
//    to a probe; real webhook deliveries hit the right URL).
// 2. Property-ID cross-check inside the handler — even if someone guessed the
//    URL, they'd need a valid cloudbedsPropertyId to trigger any work.
// 3. Idempotent sync — replay a payload, no harm done.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const expected = process.env.CLOUDBEDS_WEBHOOK_TOKEN;
  if (!expected || !tokenMatches(token, expected)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  return handleCloudbedsWebhook(payload);
}
