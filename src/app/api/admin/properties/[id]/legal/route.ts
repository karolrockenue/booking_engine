import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { legalPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isLegalSlug } from "@/lib/legal";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  const rows = await db
    .select()
    .from(legalPages)
    .where(eq(legalPages.propertyId, id));

  return NextResponse.json(rows);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json();

  const slug = body.slug as string;
  if (!slug || !isLegalSlug(slug)) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const values = {
    propertyId: id,
    slug,
    title: body.title.trim(),
    body: typeof body.body === "string" ? body.body : "",
    published: Boolean(body.published),
  };

  const [row] = await db
    .insert(legalPages)
    .values(values)
    .onConflictDoUpdate({
      target: [legalPages.propertyId, legalPages.slug],
      set: {
        title: values.title,
        body: values.body,
        published: values.published,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  return NextResponse.json(row);
}
