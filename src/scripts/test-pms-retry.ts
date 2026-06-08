/**
 * Smoke probe for the PMS retry cron.
 *
 *   set -a && source .env.local && set +a && npx tsx src/scripts/test-pms-retry.ts
 *
 * No-args mode (default): just lists stuck bookings — no side effects.
 *   Useful for checking what the next retry run will pick up.
 *
 * --run: POSTs to the cron route on http://localhost:3000 so you can step
 *   through the real retry path with the dev server running. Hits real
 *   Cloudbeds + Stripe (giveup branch) against whatever environment
 *   .env.local points at.
 */

import { findEligibleBookings } from "../lib/pms/retry-pms";

async function main() {
  const args = process.argv.slice(2);
  const shouldRun = args.includes("--run");

  const eligible = await findEligibleBookings();
  console.log(`Stuck bookings (status in paid|payment_authorized + no CB reservation): ${eligible.length}`);
  for (const b of eligible) {
    console.log(
      `  - ${b.id} status=${b.status} rateType=${b.rateType} attempts=${b.pmsRetryAttempts} firstFail=${b.firstPmsFailureAt?.toISOString() ?? "(none)"} created=${b.createdAt?.toISOString()}`
    );
  }

  if (!shouldRun) {
    console.log("\n(dry run; pass --run to hit the cron route)");
    process.exit(0);
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET not set; aborting --run");
    process.exit(1);
  }

  const url = "http://localhost:3000/api/cron/pms-retry";
  console.log(`\nPOST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const body = (await res.json()) as unknown;
  console.log(`HTTP ${res.status}`);
  console.log(JSON.stringify(body, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
