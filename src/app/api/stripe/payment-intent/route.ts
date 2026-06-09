import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createBookingPaymentIntent,
  StripeIntentError,
} from "@/lib/stripe/intents";

interface CreatePaymentIntentBody {
  propertyId?: string;
  ratePlanId?: string;
  amount?: number; // in major units (e.g. 123.45 = £123.45)
  orderId?: string; // client-generated idempotency key
  guestEmail?: string;
}

// Standalone NR intent route. The create-before-pay flow goes through
// /api/bookings/init instead; this remains for back-compat and any caller that
// only needs an intent. Both share createBookingPaymentIntent so they can't
// drift on settlement routing or idempotency.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CreatePaymentIntentBody;
  const { propertyId, ratePlanId, amount, orderId, guestEmail } = body;

  if (!propertyId || !ratePlanId || amount === undefined || !orderId) {
    return NextResponse.json(
      { error: "propertyId, ratePlanId, amount, orderId required" },
      { status: 400 }
    );
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const [plan] = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.id, ratePlanId))
    .limit(1);
  if (!plan || plan.propertyId !== propertyId) {
    return NextResponse.json({ error: "Rate plan not found" }, { status: 404 });
  }

  // NR rates pay at checkout. Flex rates use SetupIntent (other route).
  if (plan.isRefundable) {
    return NextResponse.json(
      { error: "Refundable rate must use /api/stripe/setup-intent" },
      { status: 400 }
    );
  }

  try {
    const result = await createBookingPaymentIntent({
      property,
      amount,
      orderId,
      guestEmail,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StripeIntentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Stripe PaymentIntent create failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create PaymentIntent: ${message}` },
      { status: 502 }
    );
  }
}
