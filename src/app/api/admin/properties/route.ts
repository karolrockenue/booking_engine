import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties, bookings } from "@/db/schema";
import { sql, and, gte, notInArray } from "drizzle-orm";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// GET — list all properties with dashboard tile data
export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  const [all, bookingAggs] = await Promise.all([
    db.select().from(properties),
    db
      .select({
        propertyId: bookings.propertyId,
        count: sql<number>`count(*)::int`.as("count"),
        revenue: sql<string>`coalesce(sum(${bookings.grandTotal}), 0)::text`.as("revenue"),
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.createdAt, cutoff),
          notInArray(bookings.status, ["failed", "cancelled"])
        )
      )
      .groupBy(bookings.propertyId),
  ]);

  const aggsByProperty = new Map(
    bookingAggs.map((a) => [a.propertyId, a])
  );

  const result = all.map((p) => {
    const agg = aggsByProperty.get(p.id);
    return {
      ...p,
      // Strip secrets from list response — token presence becomes a boolean
      cloudbedsAccessToken: undefined,
      cloudbedsRefreshToken: undefined,
      cloudbedsConnected: !!p.cloudbedsAccessToken,
      bookings7d: agg?.count ?? 0,
      revenue7d: agg ? Number(agg.revenue) : 0,
    };
  });

  return NextResponse.json(result);
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
