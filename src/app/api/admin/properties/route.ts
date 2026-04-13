import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties } from "@/db/schema";

// GET — list all properties
export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const all = await db.select().from(properties);
  return NextResponse.json(all);
}

// POST — create a new property
export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const { slug, name, domain, currency, timezone, theme } = body;

  if (!slug || !name || !theme) {
    return NextResponse.json(
      { error: "slug, name, and theme are required" },
      { status: 400 }
    );
  }

  const [property] = await db
    .insert(properties)
    .values({
      slug,
      name,
      domain: domain ?? null,
      currency: currency ?? "GBP",
      timezone: timezone ?? "Europe/London",
      theme,
      status: "draft",
    })
    .returning();

  return NextResponse.json(property, { status: 201 });
}
