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

export function publicOrigin(): string {
  return (
    process.env.PUBLIC_APP_URL ??
    process.env.STRIPE_RETURN_ORIGIN ??
    process.env.CLOUDBEDS_REDIRECT_URI?.split("/api/")[0] ??
    "http://localhost:3000"
  );
}
