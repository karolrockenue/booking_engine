import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { encryptToken, verifyOauthState } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/cloudbeds/client";
import { subscribeWebhooksForProperty } from "@/lib/cloudbeds/webhook-subscriptions";
import { syncInventoryForProperty } from "@/lib/cloudbeds/sync-inventory";

interface CloudbedsHotel {
  propertyID: string;
  propertyName?: string;
}

async function fetchPrimaryHotel(
  accessToken: string
): Promise<{ id: string; name: string | null } | null> {
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
  const hotel = body.data[0];
  if (!hotel.propertyID) return null;
  return { id: hotel.propertyID, name: hotel.propertyName ?? null };
}

// Slugify a hotel name and append the first UUID segment for guaranteed
// uniqueness without needing a collision-check round-trip. Fallback to
// "hotel-<uuid>" when Cloudbeds doesn't return a name.
function buildSlug(hotelName: string | null, propertyId: string): string {
  const prefix = propertyId.split("-")[0];
  if (!hotelName) return `hotel-${prefix}`;
  const slug = hotelName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug ? `${slug}-${prefix}` : `hotel-${prefix}`;
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

  // Resolve the Cloudbeds property name + ID at connection time. Name is
  // needed when this is a first-time install from /install where the property
  // row doesn't exist yet. ID is needed by sync + webhook handler later.
  const hotel = await fetchPrimaryHotel(tokens.access_token).catch(() => null);
  const cloudbedsPropertyId = hotel?.id ?? null;
  const hotelName = hotel?.name ?? null;

  // Upsert: the admin "Connect Cloudbeds" button signs state against an
  // existing property row, so we UPDATE in place. The /install Marketplace
  // flow signs state against a freshly allocated UUID with no DB row yet, so
  // we INSERT. onConflictDoUpdate handles both with a single statement.
  await db
    .insert(properties)
    .values({
      id: verified.propertyId,
      slug: buildSlug(hotelName, verified.propertyId),
      name: hotelName ?? "New Hotel",
      theme: {},
      status: "draft",
      cloudbedsAccessToken: encryptToken(tokens.access_token),
      cloudbedsRefreshToken: encryptToken(tokens.refresh_token),
      cloudbedsTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      ...(cloudbedsPropertyId ? { cloudbedsPropertyId } : {}),
    })
    .onConflictDoUpdate({
      target: properties.id,
      set: {
        cloudbedsAccessToken: encryptToken(tokens.access_token),
        cloudbedsRefreshToken: encryptToken(tokens.refresh_token),
        cloudbedsTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        ...(cloudbedsPropertyId ? { cloudbedsPropertyId } : {}),
      },
    });

  // Fire-and-forget post-connect work: webhook subscription + first inventory
  // pull. The OAuth redirect shouldn't wait on N postWebhook calls (~10 events
  // × ~500ms) or a 5-10s inventory sync. Both are idempotent so a repeat OAuth
  // (e.g. scope change) won't double-up. Inventory sync is what makes a fresh
  // install feel "complete" — without it the property has tokens but no rooms
  // and the booking flow looks broken until something else triggers a sync.
  if (cloudbedsPropertyId) {
    void subscribeWebhooksForProperty(verified.propertyId).catch((err) => {
      console.error("Cloudbeds webhook subscribe failed:", err);
    });
    void syncInventoryForProperty(verified.propertyId).catch((err) => {
      console.error("Cloudbeds initial inventory sync failed:", err);
    });
  }

  return NextResponse.redirect(
    `${publicOrigin()}/admin/${verified.propertyId}/cloudbeds?connected=1`
  );
}
