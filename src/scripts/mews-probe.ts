// Smoke-tests the Mews client foundation against the public DEMO environment.
//
// Usage:
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-probe.ts [accessToken]
//
// Defaults the AccessToken to MEWS_DEMO_ACCESS_TOKEN. Proves: (1) the timezone
// helper handles BST/GMT correctly, (2) auth works against api.mews-demo.com,
// (3) configuration/get + services/getAll return the data Phase 3 will sync.

import { mews, mewsPaginated, MEWS_CLIENT_NAME } from "../lib/pms/mews/client";
import { toMewsUtc, utcToLocalDate } from "../lib/pms/mews/timezone";

function assertEq(label: string, got: string, want: string) {
  const ok = got === want;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: ${got}${ok ? "" : ` (expected ${want})`}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const accessToken = process.argv[2] ?? process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("No AccessToken (pass as arg or set MEWS_DEMO_ACCESS_TOKEN)");
    process.exit(1);
  }

  console.log(`Client: ${MEWS_CLIENT_NAME}`);
  console.log(`Base:   ${process.env.MEWS_API_URL ?? "https://api.mews-demo.com"}`);

  // 1. Timezone helper self-test (the BST off-by-one trap).
  console.log("\n[1] Timezone helper");
  assertEq("London 2026-07-01 (BST)", toMewsUtc("2026-07-01", "Europe/London"), "2026-06-30T23:00:00.000Z");
  assertEq("London 2026-01-01 (GMT)", toMewsUtc("2026-01-01", "Europe/London"), "2026-01-01T00:00:00.000Z");
  assertEq("roundtrip back to local", utcToLocalDate(toMewsUtc("2026-07-01", "Europe/London"), "Europe/London"), "2026-07-01");

  // 2. configuration/get — enterprise identity for syncHotelDetails / connect.
  console.log("\n[2] configuration/get");
  const config = await mews<{
    Enterprise?: {
      Name?: string;
      Currencies?: Array<{ Currency?: string; IsDefault?: boolean }>;
      TimeZoneIdentifier?: string;
      Pricing?: string;
      AccountingConfiguration?: { EnabledExternalPaymentTypes?: string[] };
    };
  }>("configuration/get", accessToken, {});
  const ent = config.Enterprise ?? {};
  console.log(`  Enterprise:  ${ent.Name ?? "(none)"}`);
  console.log(`  TimeZone:    ${ent.TimeZoneIdentifier ?? "(none)"}`);
  console.log(`  Pricing:     ${ent.Pricing ?? "(none)"}  (Gross vs Net tax — drives GrossValue/NetValue)`);
  const defCur = ent.Currencies?.find((c) => c.IsDefault)?.Currency;
  console.log(`  Currency:    ${defCur ?? ent.Currencies?.[0]?.Currency ?? "(none)"}`);
  const extTypes = ent.AccountingConfiguration?.EnabledExternalPaymentTypes ?? [];
  console.log(`  External payment types enabled: ${extTypes.join(", ") || "(none — needed for payments/addExternal)"}`);

  // 3. services/getAll — which Reservable service the booking engine sells.
  console.log("\n[3] services/getAll");
  const services = await mewsPaginated<Record<string, unknown> & {
    Id?: string;
    Name?: string;
    Type?: string;
  }>("services/getAll", accessToken, {}, "Services");
  const reservable = services.filter((s) => s.Type === "Reservable");
  console.log(`  ${services.length} total · ${reservable.length} Reservable (what a booking engine sells):`);
  for (const s of reservable) {
    console.log(`   - ${s.Name ?? "(unnamed)"}  ${s.Id}`);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nPROBE FAILED:", e instanceof Error ? e.message : e);
  if (e && typeof e === "object" && "body" in e) {
    console.error("body:", JSON.stringify((e as { body: unknown }).body, null, 2).slice(0, 800));
  }
  process.exit(1);
});
