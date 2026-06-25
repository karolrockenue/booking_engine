// Ryft sub-account onboarding — the Ryft analog of Stripe Connect account
// create + account links. A hotel is a "sub account" under our platform; we
// register one per hotel, send them through Ryft's hosted onboarding portal,
// and route their payments via the `Account` header (see sessions.ts).

import { ryftFetch } from "@/lib/ryft/client";

// Our internal status vocabulary, shared with the old Stripe column semantics
// so the admin UI/copy stays rail-agnostic.
export type RyftAccountStatus = "pending" | "active" | "restricted";

interface RyftCapability {
  status?: "Enabled" | "Disabled" | "NotRequested" | "Pending" | string;
}

// The subset of the Ryft account resource we consume. Full payload is large
// (verification docs, persons, payout methods) — we only need status gating.
export interface RyftAccount {
  id: string;
  type?: string;
  status?: "ActionRequired" | "Unverified" | "VerificationPending" | "Verified" | string;
  actionsRequired?: string[];
  frozen?: boolean;
  email?: string;
  capabilities?: {
    visaPayments?: RyftCapability;
    mastercardPayments?: RyftCapability;
    [k: string]: RyftCapability | undefined;
  };
}

// Create a sub-account for a hotel. Defaults to Hosted onboarding (Ryft runs
// the KYC portal; we hand the hotel an account-link URL to finish). Email is
// the only required field for the minimal hosted flow.
export async function createSubAccount(
  email: string,
  metadata?: Record<string, string>
): Promise<RyftAccount> {
  return ryftFetch<RyftAccount>("/accounts", {
    method: "POST",
    body: { email, ...(metadata ? { metadata } : {}) },
  });
}

export async function getAccount(accountId: string): Promise<RyftAccount> {
  return ryftFetch<RyftAccount>(`/accounts/${accountId}`);
}

// Generate a temporary hosted-onboarding link for the hotel to complete
// verification/payout details. Ryft appends `?account=<id>` to redirectUrl on
// return, which /api/ryft/connect/return reads back.
export async function createAccountLink(
  accountId: string,
  redirectUrl: string
): Promise<{ url: string }> {
  return ryftFetch<{ url: string }>("/account-links", {
    method: "POST",
    body: { accountId, redirectUrl },
  });
}

// Map a Ryft account to our pending|active|restricted. Payment ability is
// gated by card *capabilities*, not the top-level verification status — a
// sandbox account can be "Unverified" yet already have visa/mastercard
// "Enabled" and take split charges. So:
//   - restricted: frozen, or locked via actionsRequired
//   - active: a card scheme capability is Enabled (and not restricted)
//   - pending: onboarding not far enough to charge yet
export function resolveRyftAccountStatus(account: RyftAccount): RyftAccountStatus {
  if (account.frozen || account.actionsRequired?.includes("AccountLocked")) {
    return "restricted";
  }
  const caps = account.capabilities ?? {};
  const cardEnabled =
    caps.visaPayments?.status === "Enabled" ||
    caps.mastercardPayments?.status === "Enabled";
  return cardEnabled ? "active" : "pending";
}
