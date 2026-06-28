// Thin server-side Ryft API client (sandbox spike).
// Auth is the raw secret key in the Authorization header — no "Bearer" prefix.
// Sub-account (Platform Fee) requests carry the sub-account id in the `Account`
// header, not the body. Amounts are always in MINOR units.

const SANDBOX_BASE = "https://sandbox-api.ryftpay.com/v1";
const LIVE_BASE = "https://api.ryftpay.com/v1";

export class RyftError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RyftError";
    this.status = status;
  }
}

function secretKey(): string {
  const key = process.env.RYFT_SECRET_KEY;
  if (!key) throw new Error("RYFT_SECRET_KEY not configured");
  return key;
}

// A handful of endpoints (attempt-payment) are public-key-authed — they're meant
// for the front-end, but a server-side off-session MIT actions the charge the
// same way with the stored card instead of raw card details.
function publicKey(): string {
  const key = process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_RYFT_PUBLIC_KEY not configured");
  return key;
}

// Pick the base URL the same way the Stripe client transparently handles
// test↔live: infer from the key prefix so a live key can never accidentally
// transact against sandbox (or vice-versa). RYFT_API_BASE overrides for
// anything non-standard (e.g. a regional host) without a code change.
function baseUrl(): string {
  const override = process.env.RYFT_API_BASE;
  if (override) return override.replace(/\/+$/, "");
  return secretKey().startsWith("sk_live_") ? LIVE_BASE : SANDBOX_BASE;
}

interface RyftFetchOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  account?: string | null; // sub-account id for Platform Fee payments
  auth?: "secret" | "public"; // attempt-payment is public-key-authed
}

export async function ryftFetch<T = Record<string, unknown>>(
  path: string,
  { method = "GET", body, account, auth = "secret" }: RyftFetchOpts = {}
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: auth === "public" ? publicKey() : secretKey(),
      "Content-Type": "application/json",
      ...(account ? { Account: account } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { errors?: { message?: string }[] })?.errors?.[0]?.message ??
      `Ryft request failed (${res.status})`;
    throw new RyftError(message, res.status);
  }
  return data as T;
}

// Origin used for 3DS/redirect returnUrls. Mirrors the resolution the Stripe
// client used so both rails point at the same public host.
export function publicOrigin(): string {
  return (
    process.env.PUBLIC_APP_URL ??
    process.env.STRIPE_RETURN_ORIGIN ??
    process.env.CLOUDBEDS_REDIRECT_URI?.split("/api/")[0] ??
    "http://localhost:3000"
  );
}
