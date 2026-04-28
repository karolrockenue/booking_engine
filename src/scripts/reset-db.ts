import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function reset() {
  const sql = neon(DATABASE_URL!);
  console.log("Dropping public schema...");
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`GRANT ALL ON SCHEMA public TO neondb_owner`;
  await sql`GRANT ALL ON SCHEMA public TO public`;
  console.log("Done. Run `npx drizzle-kit push` next, then the seed scripts.");
}

reset().catch((e) => {
  console.error(e);
  process.exit(1);
});
