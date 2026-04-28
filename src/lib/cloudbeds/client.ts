import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "../crypto";

const TOKEN_URL = "https://hotels.cloudbeds.com/api/v1.3/access_token";
const API_BASE = "https://hotels.cloudbeds.com/api/v1.3";

const REFRESH_THRESHOLD_MS = 60 * 1000;

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export async function getValidAccessToken(propertyId: string): Promise<string> {
  const [p] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!p) throw new Error(`Property ${propertyId} not found`);
  if (!p.cloudbedsAccessToken || !p.cloudbedsRefreshToken) {
    throw new Error(
      `Property ${propertyId} has no Cloudbeds tokens — connect via OAuth first`
    );
  }

  const expiresAt = p.cloudbedsTokenExpiresAt?.getTime() ?? 0;
  if (Date.now() < expiresAt - REFRESH_THRESHOLD_MS) {
    return decryptToken(p.cloudbedsAccessToken);
  }

  const refreshToken = decryptToken(p.cloudbedsRefreshToken);
  const tokens = await refreshTokens(refreshToken);

  await db
    .update(properties)
    .set({
      cloudbedsAccessToken: encryptToken(tokens.access_token),
      cloudbedsRefreshToken: encryptToken(tokens.refresh_token),
      cloudbedsTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })
    .where(eq(properties.id, propertyId));

  return tokens.access_token;
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const clientId = process.env.CLOUDBEDS_CLIENT_ID;
  const clientSecret = process.env.CLOUDBEDS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "CLOUDBEDS_CLIENT_ID / CLOUDBEDS_CLIENT_SECRET not configured"
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudbeds token refresh failed: ${res.status} ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<TokenResponse> {
  const clientId = process.env.CLOUDBEDS_CLIENT_ID;
  const clientSecret = process.env.CLOUDBEDS_CLIENT_SECRET;
  const redirectUri = process.env.CLOUDBEDS_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Cloudbeds OAuth env vars not configured (CLIENT_ID / CLIENT_SECRET / REDIRECT_URI)"
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudbeds code exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

interface CloudbedsRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function cloudbeds<T = unknown>(
  propertyId: string,
  path: string,
  opts: CloudbedsRequestOptions = {}
): Promise<T> {
  const token = await getValidAccessToken(propertyId);
  const url = new URL(API_BASE + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudbeds ${path} failed: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}
