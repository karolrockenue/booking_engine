import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";

// Current Mews connection status for the admin screen. Never returns the token.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;
  const [p] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);
  if (!p) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const creds = (p.pmsCredentials ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    connected: p.pmsType === "mews",
    pmsType: p.pmsType,
    enterpriseId: creds.enterpriseId ?? null,
    serviceId: creds.serviceId ?? null,
    timezone: creds.timezone ?? p.timezone ?? null,
    currency: creds.currency ?? p.currency ?? null,
    taxMode: creds.taxMode ?? null,
    externalPaymentType: creds.externalPaymentType ?? null,
    extrasServiceCount: Array.isArray(creds.extrasServiceIds)
      ? creds.extrasServiceIds.length
      : 0,
  });
}
