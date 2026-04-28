import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, verifyOauthState } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/cloudbeds/client";

function redirectWithError(req: NextRequest, code: string) {
  return NextResponse.redirect(
    new URL(`/admin?cloudbedsError=${encodeURIComponent(code)}`, req.url)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectWithError(req, oauthError);
  if (!code || !state) return redirectWithError(req, "missing_params");

  const verified = verifyOauthState(state);
  if (!verified) return redirectWithError(req, "invalid_state");

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error("Cloudbeds token exchange failed:", err);
    return redirectWithError(req, "token_exchange_failed");
  }

  await db
    .update(properties)
    .set({
      cloudbedsAccessToken: encryptToken(tokens.access_token),
      cloudbedsRefreshToken: encryptToken(tokens.refresh_token),
      cloudbedsTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })
    .where(eq(properties.id, verified.propertyId));

  return NextResponse.redirect(
    new URL(
      `/admin/properties/${verified.propertyId}?cloudbeds=connected`,
      req.url
    )
  );
}
