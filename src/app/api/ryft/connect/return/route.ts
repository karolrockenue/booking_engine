import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { publicOrigin } from "@/lib/ryft/client";
import { getAccount, resolveRyftAccountStatus } from "@/lib/ryft/accounts";

// Return URL after a hotel finishes Ryft's hosted onboarding — the Ryft analog
// of /api/stripe/connect/return. Ryft appends `?account=<id>`; we refresh the
// account from Ryft, recompute our status, persist it, and bounce back to admin.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId");
  const accountParam = url.searchParams.get("account");

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  const accountId = property?.ryftAccountId ?? accountParam;
  if (!accountId) {
    return NextResponse.redirect(
      `${publicOrigin()}/admin/properties/${propertyId}?ryftError=no_account`
    );
  }

  try {
    const account = await getAccount(accountId);
    await db
      .update(properties)
      .set({
        ryftAccountId: accountId,
        ryftAccountStatus: resolveRyftAccountStatus(account),
        ryftAccountCurrency: property?.currency ?? null,
      })
      .where(eq(properties.id, propertyId));
  } catch (err) {
    console.error("Ryft account retrieve failed:", err);
    return NextResponse.redirect(
      `${publicOrigin()}/admin/properties/${propertyId}?ryftError=retrieve_failed`
    );
  }

  return NextResponse.redirect(
    `${publicOrigin()}/admin/properties/${propertyId}?ryft=connected`
  );
}
