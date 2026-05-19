import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { signOauthState } from "@/lib/crypto";
import { SCOPES_STRING } from "@/lib/cloudbeds/scopes";

const AUTHORIZE_URL = "https://hotels.cloudbeds.com/api/v1.3/oauth";

// Public install entry point for the Cloudbeds Marketplace listing. A hotel
// clicks "Install" inside their Cloudbeds account, Cloudbeds redirects them
// here, we pre-allocate a property UUID, sign it into the OAuth state, and
// bounce them to Cloudbeds' authorize screen. The callback handler creates
// the property row on success (see oauth/callback/route.ts), so nothing is
// written to the DB until consent + token exchange both succeed — meaning
// an abandoned install leaves no trace.
//
// Marketplace install URL configured at:
//   https://hotels.cloudbeds.com/api/console → app settings → Install URL
//   → https://<host>/api/install
export async function GET(_req: NextRequest) {
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

  const newPropertyId = randomUUID();
  const state = signOauthState(newPropertyId);

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES_STRING);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
