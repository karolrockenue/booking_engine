import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe, publicOrigin } from "@/lib/stripe/client";
import { resolveStripeAccountStatus } from "@/lib/stripe/status";

export async function GET(req: NextRequest) {
  const propertyId = new URL(req.url).searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
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

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(property.stripeAccountId);
    const { status, currency } = resolveStripeAccountStatus(
      account,
      property.currency
    );

    await db
      .update(properties)
      .set({
        stripeAccountStatus: status,
        stripeAccountCurrency: currency,
      })
      .where(eq(properties.id, propertyId));
  } catch (err) {
    console.error("Stripe account retrieve failed:", err);
    return NextResponse.redirect(
      `${publicOrigin()}/admin/properties/${propertyId}?stripeError=retrieve_failed`
    );
  }

  return NextResponse.redirect(
    `${publicOrigin()}/admin/properties/${propertyId}?stripe=connected`
  );
}
