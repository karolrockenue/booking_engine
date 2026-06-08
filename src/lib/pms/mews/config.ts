// Reads the connection-time facts the admin needs to wire up a Mews property:
// enterprise identity, the Reservable services to choose from, the tax mode, and
// the external payment types the enterprise has enabled (needed for the
// Stripe-collected external payment in Phase 4). Used by the admin connect flow.

import { mews, mewsPaginated } from "./client";

export interface MewsConnectionInfo {
  enterpriseId: string;
  enterpriseName: string;
  timezone: string;
  currency: string;
  taxMode: string; // "Gross" | "Net" | …
  services: Array<{ id: string; name: string }>; // Reservable only
  // Orderable services (POS/F&B/etc.) — the admin picks which feed extras.
  orderableServices: Array<{ id: string; name: string }>;
  externalPaymentTypes: string[];
}

interface ConfigResponse {
  Enterprise?: {
    Id?: string;
    Name?: string;
    TimeZoneIdentifier?: string;
    Pricing?: string;
    Currencies?: Array<{ Currency?: string; IsDefault?: boolean }>;
    AccountingConfiguration?: { EnabledExternalPaymentTypes?: string[] };
  };
}

interface ServiceRow {
  Id?: string;
  Name?: string;
  Type?: string;
}

export async function fetchMewsConnectionInfo(
  accessToken: string
): Promise<MewsConnectionInfo> {
  const config = await mews<ConfigResponse>("configuration/get", accessToken, {});
  const ent = config.Enterprise ?? {};

  const defaultCurrency =
    ent.Currencies?.find((c) => c.IsDefault)?.Currency ??
    ent.Currencies?.[0]?.Currency ??
    "";

  const allServices = await mewsPaginated<ServiceRow>(
    "services/getAll",
    accessToken,
    {},
    "Services"
  );
  const services = allServices
    .filter((s) => s.Type === "Reservable" && s.Id)
    .map((s) => ({ id: s.Id as string, name: s.Name ?? "(unnamed)" }));
  const orderableServices = allServices
    .filter((s) => s.Type === "Orderable" && s.Id)
    .map((s) => ({ id: s.Id as string, name: s.Name ?? "(unnamed)" }));

  return {
    enterpriseId: ent.Id ?? "",
    enterpriseName: ent.Name ?? "",
    timezone: ent.TimeZoneIdentifier ?? "",
    currency: defaultCurrency,
    taxMode: ent.Pricing ?? "",
    services,
    orderableServices,
    externalPaymentTypes:
      ent.AccountingConfiguration?.EnabledExternalPaymentTypes ?? [],
  };
}
