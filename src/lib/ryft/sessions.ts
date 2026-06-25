// Ryft payment-session logic, the Ryft analog of the old stripe/intents.ts.
// Centralises split routing (sub-account via the `Account` header + platformFee)
// and the NR↔Flex split so callers can't drift on settlement or fee handling.
//
// Money model: amounts are MINOR units; the sub-account is the merchant of
// record (funds settle to the hotel's Ryft account), and `platformFee` is the
// slice routed to the Rockenue platform account.

import type { properties } from "@/db/schema";
import { ryftFetch, RyftError, publicOrigin } from "@/lib/ryft/client";
import { toMinorUnits } from "@/lib/ryft/amounts";

type Property = typeof properties.$inferSelect;

export class RyftSessionError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RyftSessionError";
    this.status = status;
  }
}

// Ryft payment-session response (the fields we consume). The full payload is
// persisted verbatim on payment events for audit.
export interface RyftPaymentSession {
  id: string;
  clientSecret: string;
  status:
    | "PendingPayment"
    | "PendingAction"
    | "Processing"
    | "Approved"
    | "Captured"
    | "Voided";
  customerId?: string;
}

function assertRyftActive(property: Property): void {
  if (!property.ryftAccountId || property.ryftAccountStatus !== "active") {
    throw new RyftSessionError("Property is not Ryft-active", 409);
  }
}

function platformFeeMinor(property: Property, totalMinor: number): number {
  const feePercent = Number(property.platformFeePercent ?? "3.00");
  return Math.round((totalMinor * feePercent) / 100);
}

// Route Ryft's processing fee to the hotel sub-account. `combined` books every
// Ryft-charged fee to one account and overrides the granular per-fee fields, so
// it's the safe choice regardless of the hotel's Blended/ICC++ pricing model.
// Returns undefined for non-split (no sub-account) so we never send platform
// settings on a payment that has no platform.
function feeToSubAccount(property: Property): Record<string, unknown> | undefined {
  if (!property.ryftAccountId) return undefined;
  return { paymentFees: { combined: { bookTo: property.ryftAccountId } } };
}

export interface CreatePaymentSessionArgs {
  property: Property;
  amount: number; // major units
  orderId: string;
  guestEmail?: string;
}

export interface CreatedPaymentSession {
  clientSecret: string;
  paymentSessionId: string;
  status: string;
}

// NR / pay-now: capture immediately once the customer confirms. Routes to the
// hotel sub-account and skims the platform fee.
export async function createBookingPaymentSession(
  args: CreatePaymentSessionArgs
): Promise<CreatedPaymentSession> {
  const { property, amount, orderId, guestEmail } = args;
  assertRyftActive(property);
  if (amount <= 0) throw new RyftSessionError("amount must be > 0", 400);

  const currency = property.currency ?? "GBP";
  const totalMinor = toMinorUnits(amount, currency);

  const session = await createSession(property, {
    amount: totalMinor,
    currency,
    customerEmail: guestEmail,
    platformFee: platformFeeMinor(property, totalMinor),
    captureFlow: "Automatic",
    // Book Ryft's card processing fee to the hotel sub-account (not us). On
    // Blended pricing `combined` = the full blended fee; on ICC++ it books
    // interchange+network+processor+gateway. `combined` takes precedence over
    // the granular fields and is valid on both pricing models. Net effect:
    // guest pays `amount`, we keep `platformFee`, Ryft's fee comes off the
    // hotel's settlement → hotel receives amount − platformFee − processingFee.
    platformSettings: feeToSubAccount(property),
    metadata: { orderId, propertyId: property.id },
    returnUrl: `${publicOrigin()}/api/ryft/return`,
  });

  return {
    clientSecret: session.clientSecret,
    paymentSessionId: session.id,
    status: session.status,
  };
}

export interface CreateCardSaveArgs {
  property: Property;
  orderId: string;
  guestEmail?: string;
  guestFirst?: string;
  guestLast?: string;
}

export interface CreatedCardSave {
  clientSecret: string;
  paymentSessionId: string;
  customerId: string;
  status: string;
}

// Flex / save-card: the Ryft equivalent of a Stripe SetupIntent. A zero-value
// account-verification session (`verifyAccount: true`, `amount: 0`) saves the
// card to a Ryft customer without taking money; the auto-charge cron later
// charges it off-session once the cancellation window closes. The customer
// lives on the platform account (no `Account` header) so the same saved card
// can be charged later with platform-controlled split routing.
export async function createBookingCardSave(
  args: CreateCardSaveArgs
): Promise<CreatedCardSave> {
  const { property, orderId, guestEmail, guestFirst, guestLast } = args;
  assertRyftActive(property);

  const customer = await ryftFetch<{ id: string }>("/customers", {
    method: "POST",
    body: {
      email: guestEmail,
      firstName: guestFirst,
      lastName: guestLast,
      metadata: { orderId, propertyId: property.id },
    },
  });

  const currency = property.currency ?? "GBP";
  const session = await createSession(property, {
    amount: 0,
    currency,
    verifyAccount: true,
    customerEmail: guestEmail,
    customerDetails: customer.id ? undefined : undefined,
    customerId: customer.id,
    metadata: { orderId, propertyId: property.id },
    returnUrl: `${publicOrigin()}/api/ryft/return`,
  });

  return {
    clientSecret: session.clientSecret,
    paymentSessionId: session.id,
    customerId: customer.id,
    status: session.status,
  };
}

// Capture a previously authorised (Manual captureFlow) session. Full capture
// when amount omitted.
export async function capturePaymentSession(
  paymentSessionId: string,
  account: string,
  amount?: number
): Promise<RyftPaymentSession> {
  return ryftFetch<RyftPaymentSession>(
    `/payment-sessions/${paymentSessionId}/captures`,
    { method: "POST", account, body: amount != null ? { amount } : {} }
  );
}

// Refund a captured session. Full refund when amount omitted. refundPlatformFee
// controls whether the platform's fee slice is returned too (default: keep it).
export async function refundPaymentSession(
  paymentSessionId: string,
  account: string,
  opts: { amount?: number; reason?: string; refundPlatformFee?: boolean } = {}
): Promise<RyftPaymentSession> {
  const body: Record<string, unknown> = {};
  if (opts.amount != null) body.amount = opts.amount;
  if (opts.reason) body.reason = opts.reason;
  if (opts.refundPlatformFee != null)
    body.refundPlatformFee = opts.refundPlatformFee;
  return ryftFetch<RyftPaymentSession>(
    `/payment-sessions/${paymentSessionId}/refunds`,
    { method: "POST", account, body }
  );
}

// Void an authorised-but-not-captured session (cancel before settlement).
export async function voidPaymentSession(
  paymentSessionId: string,
  account: string
): Promise<RyftPaymentSession> {
  return ryftFetch<RyftPaymentSession>(
    `/payment-sessions/${paymentSessionId}/voids`,
    { method: "POST", account, body: {} }
  );
}

// Low-level session create. Sub-account routing rides the `Account` header (not
// the body) so funds settle to the hotel; the platform takes `platformFee`.
async function createSession(
  property: Property,
  payload: Record<string, unknown>,
  account: string | null = property.ryftAccountId
): Promise<RyftPaymentSession> {
  try {
    return await ryftFetch<RyftPaymentSession>("/payment-sessions", {
      method: "POST",
      body: payload,
      account,
    });
  } catch (err) {
    if (err instanceof RyftError) {
      throw new RyftSessionError(err.message, err.status);
    }
    throw err;
  }
}
