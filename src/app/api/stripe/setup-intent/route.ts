import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/client";

interface CreateSetupIntentBody {
  propertyId?: string;
  ratePlanId?: string;
  orderId?: string;
  guestEmail?: string;
  guestFirst?: string;
  guestLast?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CreateSetupIntentBody;
  const {
    propertyId,
    ratePlanId,
    orderId,
    guestEmail,
    guestFirst,
    guestLast,
  } = body;

  if (!propertyId || !ratePlanId || !orderId) {
    return NextResponse.json(
      { error: "propertyId, ratePlanId, orderId required" },
      { status: 400 }
    );
  }
  // guestEmail is captured later via submitBooking; the Stripe customer can be
  // created without one and the email backfilled at booking submit time. This
  // lets the payment Element render immediately on /checkout.

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  if (!property.stripeAccountId || property.stripeAccountStatus !== "active") {
    return NextResponse.json(
      { error: "Property is not Stripe-active" },
      { status: 409 }
    );
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
    const stripe = getStripe();
    // Customer lives on the platform (not the connected account). The Phase 5
    // auto-charge cron creates a PaymentIntent referencing this customer +
    // saved payment method, with transfer_data routing funds to the connected
    // account at charge time.
    const customer = await stripe.customers.create(
      {
        email: guestEmail || undefined,
        name: [guestFirst, guestLast].filter(Boolean).join(" ") || undefined,
        metadata: { orderId, propertyId },
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
          propertyId,
          ratePlanId,
        },
      },
      { idempotencyKey: `si_${orderId}` }
    );

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: customer.id,
    });
  } catch (err) {
    console.error("Stripe SetupIntent create failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create SetupIntent: ${message}` },
      { status: 502 }
    );
  }
}
