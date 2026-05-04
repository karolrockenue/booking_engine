import type Stripe from "stripe";

export type StripeAccountStatus = "pending" | "active" | "restricted";

export function resolveStripeAccountStatus(
  account: Stripe.Account,
  propertyCurrency: string | null
): { status: StripeAccountStatus; currency: string | null } {
  const currency = account.default_currency ?? null;

  if (!account.details_submitted) {
    return { status: "pending", currency };
  }

  if (!account.charges_enabled || !account.payouts_enabled) {
    return { status: "restricted", currency };
  }

  // Currency mismatch is a launch-blocker per build plan: refuse to charge in
  // a currency that doesn't match the property's display currency. Surface as
  // restricted so the admin sees something is wrong rather than silently
  // taking payments in the wrong denomination.
  if (
    propertyCurrency &&
    currency &&
    propertyCurrency.toLowerCase() !== currency.toLowerCase()
  ) {
    return { status: "restricted", currency };
  }

  return { status: "active", currency };
}
