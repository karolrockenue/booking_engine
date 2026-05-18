import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken } from "@/lib/cloudbeds/client";
import { unsubscribeWebhooksForProperty } from "@/lib/cloudbeds/webhook-subscriptions";

const APP_STATE_URL = "https://hotels.cloudbeds.com/api/v1.3/postAppState";

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

  // Best-effort: unsubscribe webhooks first so Cloudbeds stops sending
  // events to a dead endpoint. (postAppState=disabled also auto-removes
  // subscriptions per Cloudbeds docs, but doing it explicitly first
  // keeps our own cloudbeds_webhook_subscriptions table in sync.)
  let webhookResult: Awaited<ReturnType<typeof unsubscribeWebhooksForProperty>> | null =
    null;
  let webhookError: string | null = null;
  try {
    webhookResult = await unsubscribeWebhooksForProperty(id);
  } catch (err) {
    webhookError = err instanceof Error ? err.message : "unsubscribe failed";
  }

  // Revoke the OAuth grant at Cloudbeds via postAppState({app_state: 'disabled'}).
  // This terminates all API sessions and removes the app from the hotel's
  // "Apps & Integrations" list — the user does NOT need to also click
  // Remove in the Cloudbeds Marketplace UI. Per Cloudbeds docs: re-installing
  // requires a fresh OAuth grant from the hotel.
  let appStateRevoked = false;
  let appStateError: string | null = null;
  try {
    const token = await getValidAccessToken(id);
    const url = new URL(APP_STATE_URL);
    url.searchParams.set("propertyID", property.cloudbedsPropertyId ?? "");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ app_state: "disabled" }).toString(),
    });
    const text = await res.text();
    let parsed: { success?: boolean; message?: string } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      /* keep parsed empty */
    }
    if (res.ok && parsed.success !== false) {
      appStateRevoked = true;
    } else {
      appStateError = `${res.status} ${parsed.message ?? text.slice(0, 200)}`;
    }
  } catch (err) {
    appStateError =
      err instanceof Error ? err.message : "postAppState failed";
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
    appStateRevoked,
    appStateError,
  });
}
