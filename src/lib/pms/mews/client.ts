// Low-level Mews Connector API client. Every call is a POST to
// `${MEWS_API_URL}/api/connector/v1/{operation}` with the auth triple
// (ClientToken + AccessToken + Client) merged into the body. Ported from the
// patterns proven in Market Pulse's mewsAdapter.js: cursor pagination, and
// backoff for 429 (rate limit) and the 403 "conflicting operation" case.
//
// Auth model (see Mews docs): ClientToken identifies our integration (one per
// environment), AccessToken identifies the enterprise (per-property, passed in),
// Client is our app name + version. Demo base: https://api.mews-demo.com.

const MEWS_API_URL = process.env.MEWS_API_URL || "https://api.mews-demo.com";
const MEWS_CLIENT_TOKEN = process.env.MEWS_CLIENT_TOKEN;
export const MEWS_CLIENT_NAME =
  process.env.MEWS_CLIENT_NAME || "Rockenue BookingEngine 1.0.0";

// 200 requests / AccessToken / rolling 30s on the live API. We back off on 429.
const MAX_ATTEMPTS = 5;

export class MewsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly operation: string,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "MewsApiError";
  }
}

interface MewsErrorBody {
  Message?: string;
  Details?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Is this a 403 caused by Mews serialising writes per-rate ("Conflicting
// operation is being performed at this time")? Those want a longer backoff.
function isConflict(status: number, body: MewsErrorBody): boolean {
  return status === 403 && /conflicting operation/i.test(body.Message ?? "");
}

/**
 * Call a Mews Connector API operation. `accessToken` is the enterprise token
 * (per property). `payload` is the operation-specific body — the auth triple is
 * added here. Returns the parsed JSON response typed as `T`.
 */
export async function mews<T = unknown>(
  operation: string,
  accessToken: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  if (!MEWS_CLIENT_TOKEN) {
    throw new Error("MEWS_CLIENT_TOKEN is not configured");
  }

  const url = `${MEWS_API_URL}/api/connector/v1/${operation}`;
  const body = JSON.stringify({
    ClientToken: MEWS_CLIENT_TOKEN,
    AccessToken: accessToken,
    Client: MEWS_CLIENT_NAME,
    ...payload,
  });

  let lastErr: MewsApiError | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
      });
    } catch (e) {
      // Network error — retry with backoff.
      lastErr = new MewsApiError(
        `Network error: ${e instanceof Error ? e.message : String(e)}`,
        0,
        operation
      );
      await sleep(attempt * 1000);
      continue;
    }

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON (e.g. an HTML error page) — surface a truncated snippet.
      throw new MewsApiError(
        `Non-JSON response (${res.status}): ${text.slice(0, 300)}`,
        res.status,
        operation
      );
    }

    if (res.ok) return parsed as T;

    const errBody = parsed as MewsErrorBody;
    lastErr = new MewsApiError(
      errBody.Message ?? `HTTP ${res.status}`,
      res.status,
      operation,
      parsed
    );

    // Decide whether to retry.
    const retryAfter = Number(res.headers.get("Retry-After"));
    if (res.status === 429) {
      await sleep(retryAfter > 0 ? retryAfter * 1000 : attempt * 2000);
      continue;
    }
    if (isConflict(res.status, errBody)) {
      // Mews serialises writes per-rate; 3, 6, 12, 24s.
      await sleep(3000 * 2 ** (attempt - 1));
      continue;
    }
    if (res.status >= 500 && res.status <= 599) {
      await sleep(attempt * 1500);
      continue;
    }

    // 4xx that isn't rate-limit/conflict — not retryable.
    throw lastErr;
  }

  throw lastErr ?? new MewsApiError("Exhausted retries", 0, operation);
}

/**
 * Paginated call. Mews pages via `Limitation { Count, Cursor }` in the request
 * and returns a `Cursor` in the response; loop until it's empty. `itemsKey` is
 * the array field in the response (e.g. "Services", "ResourceCategories").
 */
export async function mewsPaginated<TItem = unknown>(
  operation: string,
  accessToken: string,
  payload: Record<string, unknown>,
  itemsKey: string,
  count = 1000
): Promise<TItem[]> {
  const all: TItem[] = [];
  let cursor: string | null = null;

  for (;;) {
    const resp: Record<string, unknown> & { Cursor?: string | null } =
      await mews(operation, accessToken, {
        ...payload,
        Limitation: { Count: count, Cursor: cursor },
      });
    const items = resp[itemsKey];
    if (Array.isArray(items)) all.push(...(items as TItem[]));
    cursor = resp.Cursor ?? null;
    if (!cursor) break;
  }

  return all;
}
