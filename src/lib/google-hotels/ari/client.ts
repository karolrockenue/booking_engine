// ARI transport (Sprint 5). POSTs a message to Google's ARI endpoint (or our
// mock until allowlisted) and records every attempt in google_ari_messages for
// audit + replay. Endpoint + auth are env-driven so going live is a config
// swap. See "Google Hotel Center — Blueprint.md" §11.

import { db } from "@/db";
import { googleAriMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAriAccessToken, isAriMock } from "./oauth";

export type AriMessageType =
  | "property_data"
  | "transaction_price"
  | "ota_rate"
  | "ota_avail"
  | "ota_inv";

function endpoint(): string {
  // Default to the in-app mock so nothing leaves until real creds are set.
  return (
    process.env.GOOGLE_ARI_ENDPOINT ??
    `${(process.env.PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/api/google/ari/mock`
  );
}

export interface AriPostResult {
  id: string;
  status: "sent" | "failed";
  httpStatus: number | null;
  mock: boolean;
}

export async function postAriMessage(
  messageType: AriMessageType,
  xml: string,
  propertyId: string | null
): Promise<AriPostResult> {
  // Record the attempt up front (status pending) so a crash mid-send leaves a trace.
  const [row] = await db
    .insert(googleAriMessages)
    .values({ propertyId, messageType, payload: xml, status: "pending", attempts: 1 })
    .returning({ id: googleAriMessages.id });

  try {
    const token = await getAriAccessToken();
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        Authorization: `Bearer ${token}`,
        ...(process.env.GOOGLE_PARTNER_ID
          ? { "X-Partner-Id": process.env.GOOGLE_PARTNER_ID }
          : {}),
      },
      body: xml,
    });
    const ok = res.ok;
    await db
      .update(googleAriMessages)
      .set({
        status: ok ? "sent" : "failed",
        httpStatus: res.status,
        sentAt: new Date(),
        lastError: ok ? null : (await res.text()).slice(0, 500),
      })
      .where(eq(googleAriMessages.id, row.id));
    return { id: row.id, status: ok ? "sent" : "failed", httpStatus: res.status, mock: isAriMock() };
  } catch (err) {
    await db
      .update(googleAriMessages)
      .set({
        status: "failed",
        lastError: err instanceof Error ? err.message : "post failed",
      })
      .where(eq(googleAriMessages.id, row.id));
    return { id: row.id, status: "failed", httpStatus: null, mock: isAriMock() };
  }
}
