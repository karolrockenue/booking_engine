import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { emailTemplates, emailSends } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { seedEmailTemplatesForProperty } from "@/lib/email/seed-templates";

// GET — list all templates for a property. Seeds defaults on first call.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  // Seed on cold start. Idempotent — only inserts missing keys.
  const seed = await seedEmailTemplatesForProperty(id);

  const rows = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.propertyId, id));

  // Attach 7-day send counts (delivered + opened) so the list can show
  // "Sent · 7d" / "Open rate" pills without an extra fetch.
  const stats = await db
    .select({
      templateKey: emailSends.templateKey,
      total: sql<number>`count(*)::int`,
      opens: sql<number>`count(*) filter (where ${emailSends.openedAt} is not null)::int`,
    })
    .from(emailSends)
    .where(eq(emailSends.propertyId, id))
    .groupBy(emailSends.templateKey);

  const byKey = new Map(stats.map((s) => [s.templateKey, s]));

  return NextResponse.json({
    fonts: seed.fonts,
    templates: rows.map((r) => ({
      ...r,
      stats: byKey.get(r.key) ?? { total: 0, opens: 0 },
    })),
  });
}
