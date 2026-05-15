/**
 * Dry-run the email scheduler. Walks all enabled schedules and reports what
 * WOULD fire for the given target hour. Does not actually send — replaces
 * sendTemplate with a no-op via the SENDGRID_API_KEY env (if unset, sends fail
 * fast inside sendTemplate; we catch and report).
 *
 * Run with:
 *   set -a && source .env.local && set +a && npx tsx src/scripts/email-scheduler-smoke.ts [iso-datetime]
 *
 * Example: pretend it is 2026-05-12 09:00 UTC:
 *   npx tsx src/scripts/email-scheduler-smoke.ts 2026-05-12T09:00:00Z
 */

import { runEmailSchedules } from "../lib/email/scheduler";

async function main() {
  const arg = process.argv[2];
  const at = arg ? new Date(arg) : new Date();
  console.log(`Running scheduler for ${at.toISOString()}…`);

  const result = await runEmailSchedules({ at });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
