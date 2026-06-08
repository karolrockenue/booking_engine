// Migration: neutralise property_extras so it can hold a Mews product, not just
// a Cloudbeds addon. Additive + idempotent (safe to re-run):
//  - cloudbeds_addon_id → nullable
//  - add ota_extra_id (neutral product/addon id) + pms_service_id (Mews order
//    service)
//  - backfill ota_extra_id = cloudbeds_addon_id for existing Cloudbeds rows
//  - swap the unique index (property_id, cloudbeds_addon_id) → (property_id,
//    ota_extra_id)
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/migrate-extras-neutral.ts

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const [{ n, null_addon }] = (await sql`
    SELECT count(*)::int AS n,
           count(*) FILTER (WHERE cloudbeds_addon_id IS NULL)::int AS null_addon
    FROM property_extras
  `) as Array<{ n: number; null_addon: number }>;
  console.log(`Before: ${n} rows (${null_addon} with null cloudbeds_addon_id)`);

  await sql`ALTER TABLE property_extras ALTER COLUMN cloudbeds_addon_id DROP NOT NULL`;
  await sql`ALTER TABLE property_extras ADD COLUMN IF NOT EXISTS ota_extra_id text`;
  await sql`ALTER TABLE property_extras ADD COLUMN IF NOT EXISTS pms_service_id text`;

  // Backfill neutral id from the Cloudbeds id for existing rows.
  await sql`UPDATE property_extras SET ota_extra_id = cloudbeds_addon_id WHERE ota_extra_id IS NULL`;

  // All rows now have a neutral id; enforce it and swap the unique index.
  await sql`ALTER TABLE property_extras ALTER COLUMN ota_extra_id SET NOT NULL`;
  await sql`DROP INDEX IF EXISTS property_extras_property_addon_idx`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS property_extras_property_ota_idx ON property_extras (property_id, ota_extra_id)`;

  const cols = (await sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'property_extras'
    ORDER BY ordinal_position
  `) as Array<{ column_name: string; is_nullable: string }>;
  console.log("After columns:");
  for (const c of cols) console.log(`  ${c.column_name}  nullable=${c.is_nullable}`);
  const idx = (await sql`
    SELECT indexname FROM pg_indexes WHERE tablename = 'property_extras'
  `) as Array<{ indexname: string }>;
  console.log("Indexes:", idx.map((i) => i.indexname).join(", "));
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("MIGRATION FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
