// Probe the new modular Cloudbeds API for endpoints that map to the
// "Reservations" and "Types" portal scope groups.
//
// Goal: see which (if any) new endpoints respond 200 with our current
// token, which were issued under the singular scopes (read:reservation /
// read:room). 200 → singular scope covers the new endpoint. 401/403 → we
// need to add the plural scope to scopes.ts + re-OAuth.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-probe-new-scopes.ts [slug]

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken } from "../lib/cloudbeds/client";

const NEW_API_BASE = "https://api.cloudbeds.com";
const LEGACY_API_BASE = "https://hotels.cloudbeds.com/api/v1.3";

interface ProbeTarget {
  label: string;
  base: string;
  path: string;
  query?: Record<string, string>;
}

async function probe(
  ourPropertyId: string,
  cloudbedsPropertyId: string,
  target: ProbeTarget
) {
  const token = await getValidAccessToken(ourPropertyId);
  const url = new URL(target.base + target.path);
  if (target.query) {
    for (const [k, v] of Object.entries(target.query)) url.searchParams.set(k, v);
  }
  // Legacy v1.3 uses ?propertyID; modular API uses x-property-id header.
  const isLegacy = target.base === LEGACY_API_BASE;
  if (isLegacy) url.searchParams.set("propertyID", cloudbedsPropertyId);

  const start = Date.now();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(isLegacy ? {} : { "x-property-id": cloudbedsPropertyId }),
    },
  });
  const ms = Date.now() - start;
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw */
  }

  const tag = res.ok ? "✓" : "✗";
  console.log(
    `\n${tag} ${target.label}  ${res.status}  ${ms}ms  ${target.path}`
  );
  if (!res.ok) {
    console.log(
      `    ${typeof parsed === "string" ? text.slice(0, 400) : JSON.stringify(parsed).slice(0, 400)}`
    );
    return;
  }
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    console.log(`    top-level keys: ${Object.keys(obj).join(", ")}`);
    const inner = obj.data;
    if (Array.isArray(inner)) {
      console.log(`    data: array of ${inner.length}`);
      if (inner.length > 0 && typeof inner[0] === "object") {
        const item = inner[0] as Record<string, unknown>;
        console.log(
          `    sample item keys: ${Object.keys(item).slice(0, 12).join(", ")}${Object.keys(item).length > 12 ? "…" : ""}`
        );
      }
    }
  }
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
  if (!property.cloudbedsAccessToken || !property.cloudbedsPropertyId) {
    console.error(`Property "${slug}" not connected to Cloudbeds`);
    process.exit(1);
  }

  console.log(
    `Probing Cloudbeds for property "${property.name}" (cbId=${property.cloudbedsPropertyId})`
  );
  console.log(`Token issued under scopes in src/lib/cloudbeds/scopes.ts.`);

  // Anchors — endpoints we know work today, as sanity checks.
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "v1.3 getReservations (anchor)",
    base: LEGACY_API_BASE,
    path: "/getReservations",
    query: { resultsFrom: "0", resultsTo: "5" },
  });
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "v1.3 getRoomTypes (anchor)",
    base: LEGACY_API_BASE,
    path: "/getRoomTypes",
  });
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "modular /addons/v1/addons (anchor)",
    base: NEW_API_BASE,
    path: "/addons/v1/addons",
  });

  // New modular probes — guesses at the likely URL patterns. We'll
  // refine based on what 200s vs 404s.
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "modular /reservations/v1/reservations",
    base: NEW_API_BASE,
    path: "/reservations/v1/reservations",
  });
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "modular /room-types/v1/room-types",
    base: NEW_API_BASE,
    path: "/room-types/v1/room-types",
  });
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "modular /rooms/v1/rooms",
    base: NEW_API_BASE,
    path: "/rooms/v1/rooms",
  });
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "modular /rooms/v1/room-types",
    base: NEW_API_BASE,
    path: "/rooms/v1/room-types",
  });
  await probe(property.id, property.cloudbedsPropertyId, {
    label: "modular /reservation-types/v1",
    base: NEW_API_BASE,
    path: "/reservation-types/v1",
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
