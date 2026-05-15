import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { emailSends } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id } = await params;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

  const rows = await db
    .select()
    .from(emailSends)
    .where(eq(emailSends.propertyId, id))
    .orderBy(desc(emailSends.createdAt))
    .limit(limit);

  return NextResponse.json(rows);
}
