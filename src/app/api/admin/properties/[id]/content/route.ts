import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { contentBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  const blocks = await db
    .select()
    .from(contentBlocks)
    .where(eq(contentBlocks.propertyId, id));

  return NextResponse.json(blocks);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;
  const body = await req.json();

  if (!body.key || !body.content) {
    return NextResponse.json(
      { error: "key and content are required" },
      { status: 400 }
    );
  }

  // Upsert
  const [block] = await db
    .insert(contentBlocks)
    .values({
      propertyId: id,
      key: body.key,
      content: body.content,
    })
    .onConflictDoUpdate({
      target: [contentBlocks.propertyId, contentBlocks.key],
      set: { content: body.content },
    })
    .returning();

  return NextResponse.json(block, { status: 201 });
}
