import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  cached = new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
    appInfo: {
      name: "Rockenue Booking Engine",
      url: "https://rockenue.com",
    },
  });

  return cached;
}

// Stripe rejects malformed emails ("Invalid email address: karol@"). The
// checkout fires the intent as soon as its email gate passes, which can be a
// half-typed value — and once that errors, the per-orderId idempotency key is
// locked to the bad params and every retry collides. So never forward an
// invalid email to Stripe: pass it only when well-formed, else omit it (the
// real email is persisted on the booking row regardless).
export function sanitizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
}

export function publicOrigin(): string {
  return (
    process.env.PUBLIC_APP_URL ??
    process.env.STRIPE_RETURN_ORIGIN ??
    process.env.CLOUDBEDS_REDIRECT_URI?.split("/api/")[0] ??
    "http://localhost:3000"
  );
}
