import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { signOauthState } from "@/lib/crypto";
import { SCOPES_STRING } from "@/lib/cloudbeds/scopes";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq, or } from "drizzle-orm";

const AUTHORIZE_URL = "https://hotels.cloudbeds.com/api/v1.3/oauth";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { propertyId: idOrSlug } = (await req.json()) as { propertyId?: string };
  if (!idOrSlug) {
    return NextResponse.json(
      { error: "propertyId required" },
      { status: 400 }
    );
  }

  // Admin URLs use the slug (/admin/demo/...), so this can arrive as
  // either a UUID or a slug. Resolve to the canonical UUID before signing
  // state — the callback updates properties WHERE id = $1 and the id
  // column is UUID-typed, so signing a slug here will 500 on the
  // callback's update.
  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(
      UUID_RE.test(idOrSlug)
        ? eq(properties.id, idOrSlug)
        : eq(properties.slug, idOrSlug)
    )
    .limit(1);
  if (!property) {
    return NextResponse.json(
      { error: `property "${idOrSlug}" not found` },
      { status: 404 }
    );
  }

  const clientId = process.env.CLOUDBEDS_CLIENT_ID;
  const redirectUri = process.env.CLOUDBEDS_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "Cloudbeds OAuth not configured (CLOUDBEDS_CLIENT_ID / CLOUDBEDS_REDIRECT_URI)",
      },
      { status: 500 }
    );
  }

  const state = signOauthState(property.id);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES_STRING);
  url.searchParams.set("state", state);

  return NextResponse.json({ authorizeUrl: url.toString() });
}
