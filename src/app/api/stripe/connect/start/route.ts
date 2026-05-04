import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";
import { getStripe, publicOrigin } from "@/lib/stripe/client";

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { propertyId } = (await req.json()) as { propertyId?: string };
  if (!propertyId) {
    return NextResponse.json(
      { error: "propertyId required" },
      { status: 400 }
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const stripe = getStripe();

  let stripeAccountId = property.stripeAccountId;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      metadata: {
        propertyId: property.id,
        propertySlug: property.slug,
      },
    });
    stripeAccountId = account.id;

    await db
      .update(properties)
      .set({ stripeAccountId, stripeAccountStatus: "pending" })
      .where(eq(properties.id, propertyId));
  }

  const origin = publicOrigin();
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${origin}/api/stripe/connect/start?refresh=1&propertyId=${propertyId}`,
    return_url: `${origin}/api/stripe/connect/return?propertyId=${propertyId}`,
    type: "account_onboarding",
  });

  return NextResponse.json({ onboardingUrl: accountLink.url });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh");
  const propertyId = url.searchParams.get("propertyId");

  if (refresh !== "1" || !propertyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property?.stripeAccountId) {
    return NextResponse.redirect(
      `${publicOrigin()}/admin/properties/${propertyId}?stripeError=no_account`
    );
  }

  const stripe = getStripe();
  const accountLink = await stripe.accountLinks.create({
    account: property.stripeAccountId,
    refresh_url: `${publicOrigin()}/api/stripe/connect/start?refresh=1&propertyId=${propertyId}`,
    return_url: `${publicOrigin()}/api/stripe/connect/return?propertyId=${propertyId}`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url!);
}
