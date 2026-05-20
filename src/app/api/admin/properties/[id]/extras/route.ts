import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { propertyExtras } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { isPricingModel } from "@/lib/booking/extra-pricing";

// Extras catalog (synced from Cloudbeds) + their charge model. The model is our
// own config (Cloudbeds doesn't expose it); admin sets it here, the sync never
// touches it, so it survives catalog re-syncs.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId } = await params;
  const extras = await db
    .select({
      id: propertyExtras.id,
      name: propertyExtras.name,
      description: propertyExtras.description,
      priceMinorUnits: propertyExtras.priceMinorUnits,
      currency: propertyExtras.currency,
      pricingModel: propertyExtras.pricingModel,
    })
    .from(propertyExtras)
    .where(eq(propertyExtras.propertyId, propertyId))
    .orderBy(asc(propertyExtras.name));

  return NextResponse.json({ extras });
}

interface PatchBody {
  extraId?: string;
  pricingModel?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId } = await params;
  const body = (await req.json()) as PatchBody;

  if (!body.extraId || !isPricingModel(body.pricingModel)) {
    return NextResponse.json(
      { error: "extraId and a valid pricingModel are required" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(propertyExtras)
    .set({ pricingModel: body.pricingModel })
    .where(
      and(
        eq(propertyExtras.id, body.extraId),
        eq(propertyExtras.propertyId, propertyId)
      )
    )
    .returning({
      id: propertyExtras.id,
      pricingModel: propertyExtras.pricingModel,
    });

  if (!updated) {
    return NextResponse.json(
      { error: "Extra not found for this property" },
      { status: 404 }
    );
  }

  return NextResponse.json(updated);
}
