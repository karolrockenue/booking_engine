// Cloudbeds REST API smoke test (plan Step 5).
//
// Hits each endpoint we plan to use, saves full responses to
// ./tmp/cloudbeds-smoke/, prints a short summary. Read-only — safe to run
// against any connected property.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-smoke.ts [slug]
//
// Default slug is "demo".

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken } from "../lib/cloudbeds/client";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const API_BASE = "https://hotels.cloudbeds.com/api/v1.3";
const TMP_DIR = "./tmp/cloudbeds-smoke";

interface CallResult {
  label: string;
  ok: boolean;
  status: number;
  ms: number;
  data: unknown;
}

async function call(
  propertyId: string,
  label: string,
  endpoint: string,
  query: Record<string, string> = {}
): Promise<CallResult> {
  const token = await getValidAccessToken(propertyId);
  const url = new URL(API_BASE + endpoint);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const start = Date.now();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const ms = Date.now() - start;
  const text = await res.text();

  if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, { recursive: true });
  const safe = label.replace(/[^a-z0-9_]/gi, "_");
  await writeFile(path.join(TMP_DIR, `${safe}.json`), text);

  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep as text */
  }

  // Console summary
  const tag = res.ok ? "✓" : "✗";
  console.log(`\n${tag} ${label}  ${res.status}  ${ms}ms  ${endpoint}`);
  if (!res.ok) {
    const body =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
    console.log(`    ${body.slice(0, 400)}`);
  } else if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data as Record<string, unknown>);
    console.log(`    top-level keys: ${keys.join(", ")}`);
    const inner = (data as { data?: unknown }).data;
    if (Array.isArray(inner)) {
      console.log(`    data: array of ${inner.length}`);
      if (inner.length > 0 && typeof inner[0] === "object") {
        console.log(
          `    sample item keys: ${Object.keys(inner[0] as Record<string, unknown>).join(", ")}`
        );
      }
    } else if (typeof inner === "object" && inner !== null) {
      console.log(
        `    data keys: ${Object.keys(inner as Record<string, unknown>).join(", ")}`
      );
    }
  }

  return { label, ok: res.ok, status: res.status, ms, data };
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);

  if (!property) {
    console.error(`Property "${slug}" not found`);
    process.exit(1);
  }
  if (!property.cloudbedsAccessToken) {
    console.error(
      `Property "${slug}" has no Cloudbeds tokens — connect via OAuth first`
    );
    process.exit(1);
  }

  console.log(
    `Smoke-testing Cloudbeds REST API against property: ${property.name} (slug=${slug})`
  );
  console.log(`Output JSON saved to: ${TMP_DIR}/`);

  // 1. OAuth identity — confirm token is alive
  await call(property.id, "userinfo", "/userinfo");

  // 2. Hotels accessible to this token
  const hotels = await call(property.id, "getHotels", "/getHotels");

  // Try to extract the Cloudbeds property ID for subsequent calls. The
  // response shape varies by endpoint version, so try a few common spots.
  let cloudbedsPropertyId: string | undefined;
  if (hotels.ok && typeof hotels.data === "object" && hotels.data !== null) {
    const d = hotels.data as { data?: unknown; success?: boolean };
    if (Array.isArray(d.data) && d.data.length > 0) {
      const first = d.data[0] as Record<string, unknown>;
      cloudbedsPropertyId =
        (first.propertyID as string) ??
        (first.propertyId as string) ??
        (first.id as string);
    }
  }
  console.log(
    `\n→ resolved cloudbedsPropertyId: ${cloudbedsPropertyId ?? "(not found — subsequent calls may fail)"}`
  );

  if (!cloudbedsPropertyId) return;

  const today = new Date();
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);
  const in90 = new Date(today);
  in90.setDate(today.getDate() + 90);

  // 3. Hotel details
  await call(property.id, "getHotelDetails", "/getHotelDetails", {
    propertyID: cloudbedsPropertyId,
  });

  // 4. Rooms
  await call(property.id, "getRoomTypes", "/getRoomTypes", {
    propertyID: cloudbedsPropertyId,
  });
  await call(property.id, "getRooms", "/getRooms", {
    propertyID: cloudbedsPropertyId,
  });

  // 5. Rate plans (the main read for inventory sync — Step 6)
  await call(property.id, "getRatePlans_basic", "/getRatePlans", {
    propertyID: cloudbedsPropertyId,
    startDate: fmtDate(today),
    endDate: fmtDate(in30),
  });
  await call(property.id, "getRatePlans_detailed", "/getRatePlans", {
    propertyID: cloudbedsPropertyId,
    detailedRates: "true",
    startDate: fmtDate(today),
    endDate: fmtDate(in30),
  });

  // 6. Items / categories (for extras catalog — Step 7)
  await call(property.id, "getItems", "/getItems", {
    propertyID: cloudbedsPropertyId,
  });
  await call(property.id, "getItemCategories", "/getItemCategories", {
    propertyID: cloudbedsPropertyId,
  });

  // 7. Taxes & fees (for tax handling later)
  await call(property.id, "getTaxesAndFees", "/getTaxesAndFees", {
    propertyID: cloudbedsPropertyId,
  });

  // 8. Recent reservations (sanity check write:reservation scope)
  await call(property.id, "getReservations", "/getReservations", {
    propertyID: cloudbedsPropertyId,
    pageSize: "5",
  });

  // 9. Webhook subscriptions (Step 6 will subscribe to these)
  await call(property.id, "getWebhooks", "/getWebhooks", {
    propertyID: cloudbedsPropertyId,
  });

  // 10. Hunt for the cancellation policy endpoint — getRatePlans doesn't
  // return policy data, so it must live elsewhere.
  await call(property.id, "getRatePlanDetails", "/getRatePlanDetails", {
    propertyID: cloudbedsPropertyId,
  });
  await call(
    property.id,
    "getCancellationPolicies",
    "/getCancellationPolicies",
    { propertyID: cloudbedsPropertyId }
  );
  await call(property.id, "getCancellationPolicy", "/getCancellationPolicy", {
    propertyID: cloudbedsPropertyId,
  });
  await call(property.id, "getPolicies", "/getPolicies", {
    propertyID: cloudbedsPropertyId,
  });

  console.log(
    `\nDone. Inspect full responses in ${TMP_DIR}/. Notes for the next step:`
  );
  console.log(
    `  - confirm getRatePlans_detailed shape: cancellation policy fields, isRefundable signal`
  );
  console.log(`  - confirm getItems is the right home for our extras model`);
  console.log(`  - confirm webhook subscription endpoint + event names`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
