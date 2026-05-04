import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties, ratePlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/client";
import { toMinorUnits } from "@/lib/stripe/amounts";

interface CreatePaymentIntentBody {
  propertyId?: string;
  ratePlanId?: string;
  amount?: number; // in major units (e.g. 123.45 = £123.45)
  orderId?: string; // client-generated idempotency key
  guestEmail?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CreatePaymentIntentBody;
  const { propertyId, ratePlanId, amount, orderId, guestEmail } = body;

  if (!propertyId || !ratePlanId || amount === undefined || !orderId) {
    return NextResponse.json(
      { error: "propertyId, ratePlanId, amount, orderId required" },
      { status: 400 }
    );
  }

  if (amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }

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

  // NR rates pay at checkout. Flex rates use SetupIntent (other route) — guard
  // against the wrong route being called for the wrong rate type.
  if (plan.isRefundable) {
    return NextResponse.json(
      { error: "Refundable rate must use /api/stripe/setup-intent" },
      { status: 400 }
    );
  }

  const currency = property.currency ?? "GBP";
  const totalMinor = toMinorUnits(amount, currency);
  const feePercent = Number(property.platformFeePercent ?? "3.00");
  const applicationFeeAmount = Math.round((totalMinor * feePercent) / 100);

  const stripe = getStripe();

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalMinor,
        currency: currency.toLowerCase(),
        application_fee_amount: applicationFeeAmount,
        // on_behalf_of makes the connected account the merchant of record so
        // funds settle in the connected account's country/currency. Required
        // when platform and connected account are in different regions
        // (e.g. UAE platform + GB hotel) — without it Stripe refuses with
        // "funds would be settled on the platform". Safe to include even
        // when same-region: it just makes settlement explicit.
        on_behalf_of: property.stripeAccountId,
        transfer_data: { destination: property.stripeAccountId },
        receipt_email: guestEmail || undefined,
        automatic_payment_methods: { enabled: true },
        metadata: {
          orderId,
          propertyId,
          ratePlanId,
        },
      },
      // Idempotency on orderId means a network retry / double-click won't
      // create duplicate intents — Stripe returns the original.
      { idempotencyKey: `pi_${orderId}` }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe PaymentIntent create failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create PaymentIntent: ${message}` },
      { status: 502 }
    );
  }
}
