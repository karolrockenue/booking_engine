// Stripe intent creation, extracted so BOTH the standalone intent routes
// (/api/stripe/payment-intent, /api/stripe/setup-intent) and the create-before
// -pay init endpoint (/api/bookings/init) create intents through the exact same
// path — same on_behalf_of/transfer routing, same idempotency keys, no drift.
//
// These take an already-loaded property (init has it from prepareBooking; the
// routes load it themselves) and only do the Stripe-active guard + the create.
// The rate-type guard (NR↔payment, Flex↔setup) stays with the callers.

import type { properties } from "@/db/schema";
import { getStripe, sanitizeEmail } from "@/lib/stripe/client";
import { toMinorUnits } from "@/lib/stripe/amounts";

type Property = typeof properties.$inferSelect;

export class StripeIntentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StripeIntentError";
    this.status = status;
  }
}

function assertStripeActive(property: Property): void {
  if (!property.stripeAccountId || property.stripeAccountStatus !== "active") {
    throw new StripeIntentError("Property is not Stripe-active", 409);
  }
}

export interface CreatePaymentIntentArgs {
  property: Property;
  amount: number; // major units
  orderId: string;
  guestEmail?: string;
}

export interface CreatedPaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
}

export async function createBookingPaymentIntent(
  args: CreatePaymentIntentArgs
): Promise<CreatedPaymentIntent> {
  const { property, amount, orderId, guestEmail } = args;
  assertStripeActive(property);
  if (amount <= 0) {
    throw new StripeIntentError("amount must be > 0", 400);
  }

  const currency = property.currency ?? "GBP";
  const totalMinor = toMinorUnits(amount, currency);
  const feePercent = Number(property.platformFeePercent ?? "3.00");
  const applicationFeeAmount = Math.round((totalMinor * feePercent) / 100);

  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: totalMinor,
      currency: currency.toLowerCase(),
      application_fee_amount: applicationFeeAmount,
      // on_behalf_of makes the connected account the merchant of record so
      // funds settle in the connected account's country/currency. Required
      // when platform and connected account are in different regions (e.g. UAE
      // platform + GB hotel) — without it Stripe refuses with "funds would be
      // settled on the platform". Safe to include even when same-region.
      on_behalf_of: property.stripeAccountId!,
      transfer_data: { destination: property.stripeAccountId! },
      receipt_email: sanitizeEmail(guestEmail),
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId,
        propertyId: property.id,
      },
    },
    // Idempotency on orderId means a network retry / double-click won't create
    // duplicate intents — Stripe returns the original.
    { idempotencyKey: `pi_${orderId}` }
  );

  if (!paymentIntent.client_secret) {
    throw new StripeIntentError("PaymentIntent has no client secret", 502);
  }
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

export interface CreateSetupIntentArgs {
  property: Property;
  orderId: string;
  guestEmail?: string;
  guestFirst?: string;
  guestLast?: string;
}

export interface CreatedSetupIntent {
  clientSecret: string;
  setupIntentId: string;
  customerId: string;
}

export async function createBookingSetupIntent(
  args: CreateSetupIntentArgs
): Promise<CreatedSetupIntent> {
  const { property, orderId, guestEmail, guestFirst, guestLast } = args;
  assertStripeActive(property);

  const stripe = getStripe();
  // Customer lives on the platform (not the connected account). The Phase 5
  // auto-charge cron creates a PaymentIntent referencing this customer + saved
  // payment method, with transfer_data routing funds to the connected account
  // at charge time.
  const customer = await stripe.customers.create(
    {
      email: sanitizeEmail(guestEmail),
      name: [guestFirst, guestLast].filter(Boolean).join(" ") || undefined,
      metadata: { orderId, propertyId: property.id },
    },
    { idempotencyKey: `cust_${orderId}` }
  );

  const setupIntent = await stripe.setupIntents.create(
    {
      customer: customer.id,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId,
        propertyId: property.id,
      },
    },
    { idempotencyKey: `si_${orderId}` }
  );

  if (!setupIntent.client_secret) {
    throw new StripeIntentError("SetupIntent has no client secret", 502);
  }
  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    customerId: customer.id,
  };
}
