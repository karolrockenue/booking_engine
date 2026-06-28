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
  // Present once a card session resolves. For a Flex card-save (`verifyAccount`)
  // session this is the card that was saved — `tokenizedDetails.id` is the pmt_,
  // `stored` confirms it was tokenized against the customer.
  paymentMethod?: {
    tokenizedDetails?: { id?: string; stored?: boolean };
  };
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

// Ryft requires an https returnUrl. On http/localhost (dev) omit it entirely —
// the Embedded SDK handles 3DS inline, so a redirect URL isn't needed.
function ryftReturnUrl(): { returnUrl?: string } {
  const origin = publicOrigin();
  return origin.startsWith("https://")
    ? { returnUrl: `${origin}/api/ryft/return` }
    : {};
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

  // Charge in the Ryft account's settlement currency, NOT property.currency.
  // The hotel's Cloudbeds currency (and thus property.currency) can flip — e.g.
  // the Cloudbeds sandbox reports USD — but the Ryft sub-account only settles
  // its own currency, so use that (stable; the sync never touches it).
  const currency =
    property.ryftAccountCurrency ?? property.currency ?? "GBP";
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
    ...ryftReturnUrl(),
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

// Flex / save-card: the Ryft equivalent of a Stripe SetupIntent, modelled as a
// Credential-on-File (COF) mandate. A zero-value account-verification session
// (`verifyAccount: true`, `amount: 0`) saves the card without taking money; the
// auto-charge cron later charges it off-session via a Merchant-Initiated
// Transaction once the cancellation window closes.
//
// Two sandbox-proven constraints drive the shape (see the Ryft migration
// handoff):
//   1. The mandate session AND every later MIT charge must share account scope.
//      Both run on the hotel sub-account (the merchant of record), so the
//      customer, the verify session, and the saved card all live there too.
//   2. To be usable as a later `previousPayment`, this initial session must
//      itself carry `paymentType: "Unscheduled"` — a plain Standard/verify
//      session is rejected. `credentialOnFileUsage` flags it as the Customer-
//      initiated Initial in the series. `platformFee`/`splits` are forbidden on
//      verify sessions (there's no amount to split) — the fee is taken later on
//      the MIT charge instead.
export async function createBookingCardSave(
  args: CreateCardSaveArgs
): Promise<CreatedCardSave> {
  const { property, orderId, guestEmail, guestFirst, guestLast } = args;
  assertRyftActive(property);
  const account = property.ryftAccountId!; // assertRyftActive guarantees it

  // Get-or-create: emails are unique per Ryft account, so re-saving a card for
  // a guest who already has a customer (a repeat booker, or a re-test) 409s on
  // create. Fall back to looking the existing customer up by email and reusing
  // it — its saved cards live there too.
  let customer: { id: string };
  try {
    customer = await ryftFetch<{ id: string }>("/customers", {
      method: "POST",
      account,
      body: {
        email: guestEmail,
        firstName: guestFirst,
        lastName: guestLast,
        metadata: { orderId, propertyId: property.id },
      },
    });
  } catch (err) {
    if (!(err instanceof RyftError && err.status === 409 && guestEmail)) throw err;
    const found = await ryftFetch<{ items?: { id: string }[] }>(
      `/customers?email=${encodeURIComponent(guestEmail)}`,
      { account }
    );
    const existing = found.items?.[0];
    if (!existing) throw err;
    customer = existing;
  }

  // Settlement currency, not property.currency (which the Cloudbeds sync can
  // flip) — must match the later MIT charge currency.
  const currency = property.ryftAccountCurrency ?? property.currency ?? "GBP";
  const session = await createSession(property, {
    amount: 0,
    currency,
    verifyAccount: true,
    paymentType: "Unscheduled",
    credentialOnFileUsage: { initiator: "Customer", sequence: "Initial" },
    customerId: customer.id,
    customerEmail: guestEmail,
    metadata: { orderId, propertyId: property.id },
    ...ryftReturnUrl(),
  });

  return {
    clientSecret: session.clientSecret,
    paymentSessionId: session.id,
    customerId: customer.id,
    status: session.status,
  };
}

// The saved-card payment methods on a Ryft customer (sub-account scoped). The
// card stored during the card-save flow surfaces here as a `pmt_…` we charge
// off-session later. We read it at finalise rather than trusting the client.
export interface RyftPaymentMethod {
  id: string;
  type?: string;
  card?: { last4?: string; scheme?: string };
}

export async function getCustomerPaymentMethods(
  customerId: string,
  account: string
): Promise<RyftPaymentMethod[]> {
  const res = await ryftFetch<{ items?: RyftPaymentMethod[] }>(
    `/customers/${customerId}/payment-methods`,
    { account }
  );
  return res.items ?? [];
}

export interface ChargeSavedCardArgs {
  property: Property;
  amount: number; // major units
  orderId: string;
  customerId: string;
  paymentMethodId: string;
  previousPaymentSessionId: string; // the card-save (COF mandate) session
  guestEmail?: string;
}

// Off-session Merchant-Initiated charge against a previously saved card — the
// Ryft analog of a Stripe off_session+confirm PaymentIntent. No customer is
// present, so there's no SDK/3DS step: creating the session with the stored
// `paymentMethod.id` + `paymentType: "Unscheduled"` + `previousPayment` lets
// Ryft process the card on file under the mandate agreed at card-save time.
// Routes to the hotel sub-account and skims the platform fee + books Ryft's
// card fee to the hotel, exactly like the NR pay-now path.
export async function chargeSavedCard(
  args: ChargeSavedCardArgs
): Promise<RyftPaymentSession> {
  const { property, amount, orderId, customerId, paymentMethodId } = args;
  assertRyftActive(property);
  if (amount <= 0) throw new RyftSessionError("amount must be > 0", 400);

  const currency =
    property.ryftAccountCurrency ?? property.currency ?? "GBP";
  const totalMinor = toMinorUnits(amount, currency);

  return createSession(property, {
    amount: totalMinor,
    currency,
    customerId,
    customerEmail: args.guestEmail,
    paymentMethod: { id: paymentMethodId },
    paymentType: "Unscheduled",
    previousPayment: { id: args.previousPaymentSessionId },
    captureFlow: "Automatic",
    platformFee: platformFeeMinor(property, totalMinor),
    platformSettings: feeToSubAccount(property),
    metadata: { orderId, propertyId: property.id },
  });
}

// Set the customer email on an existing session. Ryft refuses to action a
// payment unless the SESSION carries customerEmail, but the storefront themes
// create the session before the guest types their email — so we patch it on
// when the details are saved, just before payment.
export async function updateSessionEmail(
  paymentSessionId: string,
  account: string,
  email: string
): Promise<void> {
  await ryftFetch(`/payment-sessions/${paymentSessionId}`, {
    method: "PATCH",
    account,
    body: { customerEmail: email },
  });
}

// Fetch a payment session to verify its status server-side (the inline
// finalise after the browser confirms — the webhook is the async backstop).
export async function getPaymentSession(
  paymentSessionId: string,
  account: string
): Promise<RyftPaymentSession> {
  return ryftFetch<RyftPaymentSession>(`/payment-sessions/${paymentSessionId}`, {
    account,
  });
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

// Delete a saved card (sub-account scoped) so it can't be charged again — used
// when a Flex booking is auto-cancelled after the grace window. Best-effort:
// single-use methods can't be deleted, which is fine (they're already spent).
export async function deletePaymentMethod(
  paymentMethodId: string,
  account: string
): Promise<void> {
  await ryftFetch(`/payment-methods/${paymentMethodId}`, {
    method: "DELETE",
    account,
  });
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
