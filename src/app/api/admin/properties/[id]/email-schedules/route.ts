import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { emailSchedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { seedEmailTemplatesForProperty } from "@/lib/email/seed-templates";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  await seedEmailTemplatesForProperty(id);
  const rows = await db
    .select()
    .from(emailSchedules)
    .where(eq(emailSchedules.propertyId, id));
  return NextResponse.json(rows);
}

// PUT — full replacement of schedules for the property. Body is an array of
// { templateKey, enabled, trigger, offsetDays, timeOfDay, audience }.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json();
  if (!Array.isArray(body.schedules)) {
    return NextResponse.json({ error: "schedules array required" }, { status: 400 });
  }
  const out = [];
  for (const s of body.schedules) {
    if (!s.templateKey || !s.trigger) continue;
    const [row] = await db
      .insert(emailSchedules)
      .values({
        propertyId: id,
        templateKey: s.templateKey,
        enabled: !!s.enabled,
        trigger: s.trigger,
        offsetDays: Number(s.offsetDays ?? 0),
        timeOfDay: s.timeOfDay ?? "09:00",
        audience: s.audience ?? "all",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [emailSchedules.propertyId, emailSchedules.templateKey],
        set: {
          enabled: !!s.enabled,
          trigger: s.trigger,
          offsetDays: Number(s.offsetDays ?? 0),
          timeOfDay: s.timeOfDay ?? "09:00",
          audience: s.audience ?? "all",
          updatedAt: new Date(),
        },
      })
      .returning();
    out.push(row);
  }
  return NextResponse.json(out);
}
