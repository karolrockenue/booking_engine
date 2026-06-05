// Reads + decrypts a Mews-connected property's stored credentials. Mews has no
// OAuth: the enterprise AccessToken is stored encrypted in
// `properties.pms_credentials` (see the connect route), alongside the chosen
// service, tax mode, timezone and external payment type. Every Mews adapter
// call resolves its auth + config through here.

import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "@/lib/crypto";

// Shape persisted by the connect route. `accessTokenEnc` is AES-GCM ciphertext.
interface StoredMewsCredentials {
  accessTokenEnc?: string;
  serviceId?: string;
  timezone?: string;
  enterpriseId?: string;
  taxMode?: string; // "Gross" | "Net"
  externalPaymentType?: string | null;
  currency?: string;
}

export interface MewsCredentials {
  accessToken: string;
  serviceId: string;
  timezone: string;
  enterpriseId: string;
  taxMode: string;
  externalPaymentType: string | null;
  currency: string;
}

// Resolve decrypted Mews credentials for a property. Throws if the property
// isn't a connected Mews property or the stored shape is incomplete — every
// read/write path needs a usable AccessToken + serviceId.
export async function getMewsCredentials(
  propertyId: string
): Promise<MewsCredentials> {
  const [property] = await db
    .select({
      pmsType: properties.pmsType,
      pmsCredentials: properties.pmsCredentials,
      timezone: properties.timezone,
      currency: properties.currency,
    })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) throw new Error(`Property ${propertyId} not found`);
  if (property.pmsType !== "mews") {
    throw new Error(`Property ${propertyId} is not connected to Mews`);
  }

  const creds = (property.pmsCredentials ?? {}) as StoredMewsCredentials;
  if (!creds.accessTokenEnc) {
    throw new Error(`Property ${propertyId} has no Mews AccessToken stored`);
  }
  if (!creds.serviceId) {
    throw new Error(
      `Property ${propertyId} has no Mews serviceId stored — re-connect the property`
    );
  }

  return {
    accessToken: decryptToken(creds.accessTokenEnc),
    serviceId: creds.serviceId,
    // Fall back to the property's own tz/currency if the credential copy is missing.
    timezone: creds.timezone || property.timezone || "Europe/London",
    enterpriseId: creds.enterpriseId ?? "",
    taxMode: creds.taxMode || "Gross",
    externalPaymentType: creds.externalPaymentType ?? null,
    currency: creds.currency || property.currency || "GBP",
  };
}
