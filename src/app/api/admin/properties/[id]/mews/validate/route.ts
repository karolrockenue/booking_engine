import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";
import { fetchMewsConnectionInfo } from "@/lib/pms/mews/config";

// Step 1 of connecting a Mews property: validate a pasted enterprise AccessToken
// and return the options the admin must choose from (Reservable service +
// external payment type) plus the enterprise identity to confirm. Stores
// nothing — the connect route persists once the admin confirms.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;
  const { accessToken } = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
  };
  if (!accessToken) {
    return NextResponse.json({ error: "accessToken required" }, { status: 400 });
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
    return NextResponse.json(info);
  } catch (e) {
    return NextResponse.json(
      {
        error: `Could not validate: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 502 }
    );
  }
}
