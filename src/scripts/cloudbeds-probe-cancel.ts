// Probe for the correct Cloudbeds cancellation endpoint.
//
// Our reservations.ts calls PUT /putReservationStatus which 404s with
// the marketing HTML page → endpoint name (or method) is wrong. Try
// the most likely variants against a real stuck reservation.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/cloudbeds-probe-cancel.ts demo <reservationID>

import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken } from "../lib/cloudbeds/client";

const BASE = "https://hotels.cloudbeds.com/api/v1.3";

interface Variant {
  label: string;
  method: "POST" | "PUT";
  path: string;
  body: (resId: string) => URLSearchParams;
}

const VARIANTS: Variant[] = [
  {
    label: "POST /postReservationCancel",
    method: "POST",
    path: "/postReservationCancel",
    body: (id) => new URLSearchParams({ reservationID: id }),
  },
  {
    label: "POST /putReservationStatus",
    method: "POST",
    path: "/putReservationStatus",
    body: (id) =>
      new URLSearchParams({ reservationID: id, status: "canceled" }),
  },
  {
    label: "POST /cancelReservation",
    method: "POST",
    path: "/cancelReservation",
    body: (id) => new URLSearchParams({ reservationID: id }),
  },
  {
    label: "POST /putReservation (status=canceled)",
    method: "POST",
    path: "/putReservation",
    body: (id) =>
      new URLSearchParams({ reservationID: id, status: "canceled" }),
  },
  {
    label: "PUT /reservation/cancel",
    method: "PUT",
    path: "/reservation/cancel",
    body: (id) => new URLSearchParams({ reservationID: id }),
  },
];

async function main() {
  const slug = process.argv[2] ?? "demo";
  const reservationID = process.argv[3];
  if (!reservationID) {
    console.error(
      "Usage: cloudbeds-probe-cancel.ts <slug> <reservationID>"
    );
    process.exit(1);
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!property?.cloudbedsAccessToken || !property.cloudbedsPropertyId) {
    console.error("Property not connected");
    process.exit(1);
  }

  const token = await getValidAccessToken(property.id);
  console.log(`Probing cancel endpoints for reservation ${reservationID}…\n`);

  for (const v of VARIANTS) {
    const url = new URL(BASE + v.path);
    url.searchParams.set("propertyID", property.cloudbedsPropertyId);
    const res = await fetch(url, {
      method: v.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: v.body(reservationID).toString(),
    });
    const text = await res.text();
    const isHtml = text.trimStart().startsWith("<");
    const tag = res.ok ? "✓" : res.status === 404 ? "✗" : "?";
    console.log(`${tag} ${res.status}  ${v.method} ${v.path}`);
    if (!isHtml) {
      console.log(`    ${text.slice(0, 300)}`);
    }
    // Stop on first success so we don't keep mutating
    if (res.ok) {
      console.log(
        `\nFound it: ${v.method} ${v.path}. Reservation ${reservationID} should now be cancelled.`
      );
      process.exit(0);
    }
  }

  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
