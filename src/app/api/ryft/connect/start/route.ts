import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";
import { publicOrigin } from "@/lib/ryft/client";
import {
  createSubAccount,
  createAccountLink,
  getAccount,
  resolveRyftAccountStatus,
} from "@/lib/ryft/accounts";

// Start Ryft onboarding for a hotel — the Ryft analog of /api/stripe/connect/
// start. Creates the sub-account on first run (storing ryftAccountId + pending)
// then returns a hosted-onboarding link the hotel completes in Ryft's portal.

function onboardingEmail(slug: string, fallback?: string | null): string {
  return fallback || `ryft-${slug}@rockenue.com`;
}

function returnUrl(propertyId: string): string {
  return `${publicOrigin()}/api/ryft/connect/return?propertyId=${propertyId}`;
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { propertyId } = (await req.json()) as { propertyId?: string };
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  let ryftAccountId = property.ryftAccountId;

  if (!ryftAccountId) {
    const created = await createSubAccount(
      onboardingEmail(property.slug, property.emailFromAddress),
      { propertyId: property.id, propertySlug: property.slug }
    );
    ryftAccountId = created.id;
    await db
      .update(properties)
      .set({ ryftAccountId, ryftAccountStatus: "pending" })
      .where(eq(properties.id, propertyId));
  }

  // Refresh status from Ryft. In sandbox a new sub-account already has card
  // capabilities enabled, so it's chargeable ("active") without finishing KYC.
  const account = await getAccount(ryftAccountId);
  const status = resolveRyftAccountStatus(account);
  await db
    .update(properties)
    .set({
      ryftAccountStatus: status,
      ryftAccountCurrency: property.currency ?? null,
    })
    .where(eq(properties.id, propertyId));

  // Already chargeable → no hosted onboarding needed; the UI just reloads.
  if (status === "active") {
    return NextResponse.json({ active: true, status });
  }

  // Hosted onboarding requires an HTTPS redirect (Ryft rejects http/localhost).
  // Only offer the link when we have an https public origin (prod or a tunnel).
  if (returnUrl(propertyId).startsWith("https://")) {
    const { url } = await createAccountLink(ryftAccountId, returnUrl(propertyId));
    return NextResponse.json({ onboardingUrl: url });
  }

  return NextResponse.json({
    active: false,
    status,
    message:
      "Sub-account created but not yet chargeable, and hosted onboarding needs an HTTPS origin (set PUBLIC_APP_URL to your https tunnel/prod URL).",
  });
}

// Ryft's hosted portal can bounce the user back here to refresh an expired
// link (mirrors Stripe's refresh_url). Regenerates a fresh link and redirects.
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

  if (!property?.ryftAccountId) {
    return NextResponse.redirect(
      `${publicOrigin()}/admin/properties/${propertyId}?ryftError=no_account`
    );
  }

  const link = await createAccountLink(property.ryftAccountId, returnUrl(propertyId));
  return NextResponse.redirect(link.url);
}
