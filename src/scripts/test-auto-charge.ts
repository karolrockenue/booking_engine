/**
 * Smoke probe for the Flex auto-charge cron.
 *
 *   set -a && source .env.local && set +a && npx tsx src/scripts/test-auto-charge.ts
 *
 * No-args mode (default): just lists eligible bookings — no side effects.
 *   Useful for checking what the next cron run will pick up.
 *
 * --run: actually POSTs to the cron route on http://localhost:3000 so you can
 *   step through the real charge path with the dev server running. Hits real
 *   Stripe + Cloudbeds against whatever environment .env.local points at.
 */

import { findEligibleBookings } from "../lib/stripe/auto-charge";

async function main() {
  const args = process.argv.slice(2);
  const shouldRun = args.includes("--run");

  const eligible = await findEligibleBookings();
  console.log(`Eligible Flex bookings hitting chargeAt: ${eligible.length}`);
  for (const b of eligible) {
    console.log(
      `  - ${b.id} chargeAt=${b.chargeAt?.toISOString()} attempts=${b.autoChargeAttempts} firstFail=${b.firstAutoChargeFailureAt?.toISOString() ?? "(none)"} status=${b.status}`
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

  const url = "http://localhost:3000/api/cron/auto-charge";
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
