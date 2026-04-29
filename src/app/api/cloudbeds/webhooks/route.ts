import { NextRequest, NextResponse } from "next/server";
import {
  handleCloudbedsWebhook,
  type WebhookPayload,
} from "@/lib/cloudbeds/webhook-handler";

// LEGACY: kept alive only until existing Cloudbeds subscriptions are migrated
// to /api/cloudbeds/webhooks/[token] via cloudbeds-rotate-webhooks.ts. Once
// that migration is verified and our cloudbeds_webhook_subscriptions table no
// longer references this URL, delete this file.
export async function POST(req: NextRequest) {
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  return handleCloudbedsWebhook(payload);
}
