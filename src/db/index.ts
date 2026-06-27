import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// The Neon serverless driver issues one HTTP fetch per query. On an unstable
// network a single fetch can drop with `TypeError: fetch failed`, which would
// otherwise surface as a 500 on whatever page ran that query. Retry transient
// failures a few times with short backoff so one dropped request self-heals.
// `fetch failed` errors throw quickly (connection reset/refused), so retries
// are cheap; slow-but-successful queries are untouched (we only retry throws).
neonConfig.fetchFunction = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
