import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";
import { encryptToken } from "@/lib/crypto";
import { fetchMewsConnectionInfo } from "@/lib/pms/mews/config";

// Step 2 of connecting a Mews property: persist the connection. Re-validates the
// token (so we store canonical enterprise values), checks the chosen service +
// payment type are real, encrypts the AccessToken, and flips the property to
// pms_type='mews'. Inventory sync lands in Phase 3.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;
  const { accessToken, serviceId, externalPaymentType } = (await req
    .json()
    .catch(() => ({}))) as {
    accessToken?: string;
    serviceId?: string;
    externalPaymentType?: string;
  };

  if (!accessToken || !serviceId) {
    return NextResponse.json(
      { error: "accessToken and serviceId are required" },
      { status: 400 }
    );
  }

  try {
    const [property] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, id))
      .limit(1);
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const info = await fetchMewsConnectionInfo(accessToken);

    if (!info.services.some((s) => s.id === serviceId)) {
      return NextResponse.json(
        { error: "serviceId is not a Reservable service of this enterprise" },
        { status: 400 }
      );
    }
    if (
      externalPaymentType &&
      !info.externalPaymentTypes.includes(externalPaymentType)
    ) {
      return NextResponse.json(
        { error: "externalPaymentType is not enabled on this enterprise" },
        { status: 400 }
      );
    }

    await db
      .update(properties)
      .set({
        pmsType: "mews",
        pmsCredentials: {
          accessTokenEnc: encryptToken(accessToken),
          serviceId,
          timezone: info.timezone,
          enterpriseId: info.enterpriseId,
          taxMode: info.taxMode,
          externalPaymentType: externalPaymentType ?? null,
          currency: info.currency,
        },
        // Align the property's tz/currency with the Mews enterprise so the
        // storefront and emails match the PMS.
        timezone: info.timezone || undefined,
        currency: info.currency || undefined,
      })
      .where(eq(properties.id, id));

    return NextResponse.json({
      ok: true,
      enterpriseName: info.enterpriseName,
      serviceId,
      timezone: info.timezone,
      currency: info.currency,
      taxMode: info.taxMode,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not connect: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
