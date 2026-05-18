import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { unsubscribeWebhooksForProperty } from "@/lib/cloudbeds/webhook-subscriptions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!property.cloudbedsAccessToken) {
    return NextResponse.json(
      { ok: true, alreadyDisconnected: true },
      { status: 200 }
    );
  }

  // Best-effort: try to unsubscribe webhooks first so Cloudbeds stops sending
  // events to a dead endpoint. If this fails (token already revoked at
  // Cloudbeds, network blip, etc.) we still proceed with the local disconnect
  // — leaving stale tokens behind is the worse outcome.
  let webhookResult: Awaited<ReturnType<typeof unsubscribeWebhooksForProperty>> | null =
    null;
  let webhookError: string | null = null;
  try {
    webhookResult = await unsubscribeWebhooksForProperty(id);
  } catch (err) {
    webhookError = err instanceof Error ? err.message : "unsubscribe failed";
  }

  await db
    .update(properties)
    .set({
      cloudbedsAccessToken: null,
      cloudbedsRefreshToken: null,
      cloudbedsTokenExpiresAt: null,
    })
    .where(eq(properties.id, id));

  return NextResponse.json({
    ok: true,
    webhook: webhookResult,
    webhookError,
  });
}
