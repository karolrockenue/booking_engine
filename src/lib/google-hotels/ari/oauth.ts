// OAuth 2.0 for the Google Travel Partner ARI upload (Sprint 5).
//
// Uses a Google Cloud service account: sign a JWT with the account's private
// key and exchange it for an access token (the standard service-account flow).
// The `travel-partner-price-upload` scope is only authorized once Hotel Center
// allowlists us, so until then we run in MOCK mode and return a placeholder
// token — enough to exercise the generate → POST → log loop against our mock
// endpoint. Set GOOGLE_ARI_OAUTH_KEY (JSON service-account key) + unset
// GOOGLE_ARI_MOCK to go live.
//
// See "Google Hotel Center — Blueprint.md" §11.

import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/travel-partner-price-upload";
const TOKEN_URI = "https://oauth2.googleapis.com/token";

export function isAriMock(): boolean {
  // Mock unless a real service-account key is configured.
  return process.env.GOOGLE_ARI_MOCK === "true" || !process.env.GOOGLE_ARI_OAUTH_KEY;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getAriAccessToken(): Promise<string> {
  if (isAriMock()) return "mock-ari-access-token";

  // Reuse a still-valid token (Google tokens last ~1h; refresh 60s early).
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const key = JSON.parse(process.env.GOOGLE_ARI_OAUTH_KEY as string) as ServiceAccountKey;
  const tokenUri = key.token_uri ?? TOKEN_URI;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: tokenUri,
      iat,
      exp,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signature = base64url(
    createSign("RSA-SHA256").update(signingInput).sign(key.private_key)
  );
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google ARI token exchange failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}
