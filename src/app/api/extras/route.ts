import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { properties, propertyExtras } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { syncExtrasForProperty } from "@/lib/cloudbeds/sync-extras";

const fetchExtrasForProperty = unstable_cache(
  async (propertyId: string) => {
    const rows = await db
      .select({
        id: propertyExtras.id,
        name: propertyExtras.name,
        description: propertyExtras.description,
        priceMinorUnits: propertyExtras.priceMinorUnits,
        currency: propertyExtras.currency,
      })
      .from(propertyExtras)
      .where(eq(propertyExtras.propertyId, propertyId));
    return rows;
  },
  ["property-extras"],
  { revalidate: 60 }
);

export async function GET(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json(
      { error: "Missing propertyId" },
      { status: 400 }
    );
  }

  // Cold-start: if the property is connected to Cloudbeds but we have no
  // extras rows yet, sync synchronously so the first booking page after OAuth
  // doesn't render an empty list.
  const [coldStartCheck] = await db
    .select({
      cloudbedsPropertyId: properties.cloudbedsPropertyId,
      hasExtras: sql<boolean>`EXISTS (
        SELECT 1 FROM ${propertyExtras}
        WHERE ${propertyExtras.propertyId} = ${properties.id}
      )`,
    })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (coldStartCheck?.cloudbedsPropertyId && !coldStartCheck.hasExtras) {
    try {
      await syncExtrasForProperty(propertyId);
    } catch (e) {
      console.error(
        `extras cold-start sync failed: ${e instanceof Error ? e.message : String(e)}`
      );
      // Fall through — return whatever (empty) extras we have rather than 500.
    }
  }

  const extras = await fetchExtrasForProperty(propertyId);
  return NextResponse.json({ extras });
}
