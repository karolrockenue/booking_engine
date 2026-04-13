import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  const propertyPages = await db
    .select()
    .from(pages)
    .where(eq(pages.propertyId, id));

  return NextResponse.json(propertyPages);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json();

  if (!body.slug || !body.layout) {
    return NextResponse.json(
      { error: "slug and layout are required" },
      { status: 400 }
    );
  }

  // Upsert — update if page with this slug exists, create otherwise
  const [page] = await db
    .insert(pages)
    .values({
      propertyId: id,
      slug: body.slug,
      title: body.title ?? null,
      metaDescription: body.metaDescription ?? null,
      layout: body.layout,
    })
    .onConflictDoUpdate({
      target: [pages.propertyId, pages.slug],
      set: {
        title: body.title ?? null,
        metaDescription: body.metaDescription ?? null,
        layout: body.layout,
      },
    })
    .returning();

  return NextResponse.json(page, { status: 201 });
}
