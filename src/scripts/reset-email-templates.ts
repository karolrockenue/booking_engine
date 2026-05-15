/**
 * One-shot: delete all email_templates rows for a property (or all properties)
 * so seedEmailTemplatesForProperty re-inserts them in the new Unlayer format.
 *
 * Run with:
 *   set -a && source .env.local && set +a && npx tsx src/scripts/reset-email-templates.ts [slug|--all]
 *
 * Defaults to slug "demo". Safe to re-run.
 */

import { db } from "../db";
import { emailTemplates, properties } from "../db/schema";
import { eq, isNull, or } from "drizzle-orm";
import { seedEmailTemplatesForProperty } from "../lib/email/seed-templates";

async function main() {
  const arg = process.argv[2] ?? "demo";

  const propRows =
    arg === "--all"
      ? await db.select().from(properties)
      : await db.select().from(properties).where(eq(properties.slug, arg));

  if (propRows.length === 0) {
    console.error(`No property found for ${arg}`);
    process.exit(1);
  }

  for (const p of propRows) {
    // Drop legacy Maily rows (htmlCached IS NULL OR body_format != 'unlayer').
    // The seeder is idempotent on conflict but will not overwrite existing
    // rows — so deleting is the right path for the migration.
    const deleted = await db
      .delete(emailTemplates)
      .where(
        // either field flags legacy
        // - htmlCached null means Maily renderer never populated it
        // - bodyFormat != 'unlayer' means an older write happened
        // Both checks are belt-and-braces; in practice htmlCached IS NULL covers it.
        // drizzle: combine with or()
        or(isNull(emailTemplates.htmlCached), eq(emailTemplates.bodyFormat, "maily")) as never
      )
      .returning({ key: emailTemplates.key, propertyId: emailTemplates.propertyId });

    const droppedForThis = deleted.filter((d) => d.propertyId === p.id);
    console.log(`[${p.slug}] dropped ${droppedForThis.length} legacy template rows`);

    const result = await seedEmailTemplatesForProperty(p.id);
    console.log(
      `[${p.slug}] seeded — templates inserted: ${result.templatesInserted}, schedules inserted: ${result.schedulesInserted}, fonts: ${result.fonts.headingDisplayName} + ${result.fonts.bodyDisplayName}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
