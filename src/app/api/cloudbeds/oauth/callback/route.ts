import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, verifyOauthState } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/cloudbeds/client";
import { subscribeWebhooksForProperty } from "@/lib/cloudbeds/webhook-subscriptions";

interface CloudbedsHotel {
  propertyID: string;
  propertyName?: string;
}

async function fetchPrimaryHotelId(
  accessToken: string
): Promise<string | null> {
  const res = await fetch("https://hotels.cloudbeds.com/api/v1.3/getHotels", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    success?: boolean;
    data?: CloudbedsHotel[];
  };
  if (!body.success || !body.data || body.data.length === 0) return null;
  return body.data[0].propertyID ?? null;
}

// Use the public origin from CLOUDBEDS_REDIRECT_URI, not req.url. Inside
// Railway the request URL reflects the internal localhost:8080 host, not the
// public Railway domain — using req.url for redirects breaks the round trip.
function publicOrigin(): string {
  const redirectUri = process.env.CLOUDBEDS_REDIRECT_URI;
  if (redirectUri) return new URL(redirectUri).origin;
  return "http://localhost:3000";
}

function redirectWithError(code: string) {
  return NextResponse.redirect(
    `${publicOrigin()}/admin?cloudbedsError=${encodeURIComponent(code)}`
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectWithError(oauthError);
  if (!code || !state) return redirectWithError("missing_params");

  const verified = verifyOauthState(state);
  if (!verified) return redirectWithError("invalid_state");

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error("Cloudbeds token exchange failed:", err);
    return redirectWithError("token_exchange_failed");
  }

  // Resolve the Cloudbeds property ID once at connection time so subsequent
  // calls (sync, webhook handler) don't have to. Don't fail the whole flow if
  // this call hits a hiccup — a fallback in syncInventoryForProperty will
  // backfill it on the first sync run.
  const cloudbedsPropertyId = await fetchPrimaryHotelId(
    tokens.access_token
  ).catch(() => null);

  await db
    .update(properties)
    .set({
      cloudbedsAccessToken: encryptToken(tokens.access_token),
      cloudbedsRefreshToken: encryptToken(tokens.refresh_token),
      cloudbedsTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      ...(cloudbedsPropertyId ? { cloudbedsPropertyId } : {}),
    })
    .where(eq(properties.id, verified.propertyId));

  // Auto-subscribe to webhooks so the property starts receiving live events
  // immediately. Fire and forget — the OAuth redirect shouldn't wait on N
  // postWebhook calls (~10 events × ~500ms each). subscribeWebhooksForProperty
  // is idempotent, so on repeat OAuth (e.g. scope change) we won't double-up.
  if (cloudbedsPropertyId) {
    void subscribeWebhooksForProperty(verified.propertyId).catch((err) => {
      console.error("Cloudbeds webhook subscribe failed:", err);
    });
  }

  return NextResponse.redirect(
    `${publicOrigin()}/admin/properties/${verified.propertyId}?cloudbeds=connected`
  );
}
