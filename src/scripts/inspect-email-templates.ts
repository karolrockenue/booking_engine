import { db } from "../db";
import { emailTemplates, properties } from "../db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const slug = process.argv[2] ?? "demo";
  const [p] = await db.select().from(properties).where(eq(properties.slug, slug));
  if (!p) {
    console.error(`No property found for ${slug}`);
    process.exit(1);
  }
  const rows = await db
    .select({
      key: emailTemplates.key,
      bodyFormat: emailTemplates.bodyFormat,
      htmlCached: emailTemplates.htmlCached,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.propertyId, p.id));
  for (const r of rows) {
    console.log(
      r.key.padEnd(15),
      "·",
      r.bodyFormat.padEnd(8),
      "·",
      r.htmlCached ? `${r.htmlCached.length} bytes html` : "no html"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
