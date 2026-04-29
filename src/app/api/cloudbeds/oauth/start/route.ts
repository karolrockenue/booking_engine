import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { signOauthState } from "@/lib/crypto";

const SCOPES = [
  "read:addon",
  "read:currency",
  "read:dataInsightsGuests",
  "read:dataInsightsOccupancy",
  "read:dataInsightsReservations",
  "read:guest",
  "write:guest",
  "read:hotel",
  "read:rate",
  "write:rate",
  "read:reservation",
  "write:reservation",
  "read:room",
  "read:roomBlock",
  "read:taxesAndFees",
  "read:user",
].join(" ");

const AUTHORIZE_URL = "https://hotels.cloudbeds.com/api/v1.3/oauth";

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

  const state = signOauthState(propertyId);
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);

  return NextResponse.json({ authorizeUrl: url.toString() });
}
