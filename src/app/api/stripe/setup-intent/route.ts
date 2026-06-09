import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createBookingSetupIntent,
  StripeIntentError,
} from "@/lib/stripe/intents";

interface CreateSetupIntentBody {
  propertyId?: string;
  ratePlanId?: string;
  orderId?: string;
  guestEmail?: string;
  guestFirst?: string;
  guestLast?: string;
}

// Standalone Flex intent route. The create-before-pay flow goes through
// /api/bookings/init instead; this remains for back-compat. Both share
// createBookingSetupIntent so they can't drift.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CreateSetupIntentBody;
  const { propertyId, ratePlanId, orderId, guestEmail, guestFirst, guestLast } =
    body;

  if (!propertyId || !ratePlanId || !orderId) {
    return NextResponse.json(
      { error: "propertyId, ratePlanId, orderId required" },
      { status: 400 }
    );
  }
  // guestEmail is captured later via the booking flow; the Stripe customer can
  // be created without one and the email backfilled at submit time. This lets
  // the payment Element render immediately on /checkout.

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

  if (!plan.isRefundable) {
    return NextResponse.json(
      { error: "Non-refundable rate must use /api/stripe/payment-intent" },
      { status: 400 }
    );
  }

  try {
    const result = await createBookingSetupIntent({
      property,
      orderId,
      guestEmail,
      guestFirst,
      guestLast,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof StripeIntentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Stripe SetupIntent create failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create SetupIntent: ${message}` },
      { status: 502 }
    );
  }
}
