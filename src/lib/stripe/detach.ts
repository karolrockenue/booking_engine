import { getStripe } from "./client";

/**
 * Detach a saved payment method from its Stripe Customer. Used when a Flex
 * booking is cancelled before charge — we want the saved card off the
 * customer so it can't be charged later (also visible to the guest as
 * "removed" in their account if they ever look).
 *
 * Idempotent in spirit: Stripe returns 404 / "no such payment_method" if the
 * PM is already detached or never existed. Caller decides whether to swallow.
 */
export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<{ detached: boolean; alreadyDetached: boolean }> {
  const stripe = getStripe();
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { detached: true, alreadyDetached: false };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    const message = (err as { message?: string }).message ?? "";
    // Stripe returns "resource_missing" if the PM is gone. Treat as success
    // — the post-condition (PM not attached) is what we wanted.
    if (code === "resource_missing" || /No such payment_method/i.test(message)) {
      return { detached: false, alreadyDetached: true };
    }
    throw err;
  }
}
