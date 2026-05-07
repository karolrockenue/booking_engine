import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe/client";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id } = await params;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, id))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stripeAccountId = property.stripeAccountId;
  if (!stripeAccountId) {
    return NextResponse.json({
      connected: false,
      account: null,
      platform: null,
      hotel: null,
      fromDb: {
        platformFeePercent: property.platformFeePercent,
        payoutSchedule: property.payoutSchedule,
        stripeAccountStatus: property.stripeAccountStatus,
        stripeAccountCurrency: property.stripeAccountCurrency,
      },
    });
  }

  const stripe = getStripe();
  const since = Math.floor((Date.now() - THIRTY_DAYS_MS) / 1000);

  const [accountResult, feesResult, payoutsResult, balanceResult, refundsResult] =
    await Promise.allSettled([
      stripe.accounts.retrieve(stripeAccountId),
      // Stripe's API doesn't support filtering applicationFees by account
      // server-side. Fetch all fees in window, then filter in JS by account.
      stripe.applicationFees.list({
        limit: 100,
        created: { gte: since },
      }),
      stripe.payouts.list(
        { limit: 10 },
        { stripeAccount: stripeAccountId }
      ),
      stripe.balance.retrieve(undefined, { stripeAccount: stripeAccountId }),
      stripe.refunds.list(
        { limit: 10 },
        { stripeAccount: stripeAccountId }
      ),
    ]);

  const account =
    accountResult.status === "fulfilled" ? accountResult.value : null;
  const allFees =
    feesResult.status === "fulfilled" ? feesResult.value.data : [];
  // Filter to fees originating from this connected account.
  const fees = allFees.filter((f) =>
    typeof f.account === "string"
      ? f.account === stripeAccountId
      : f.account?.id === stripeAccountId
  );
  const payouts =
    payoutsResult.status === "fulfilled" ? payoutsResult.value.data : [];
  const balance =
    balanceResult.status === "fulfilled" ? balanceResult.value : null;
  const refunds =
    refundsResult.status === "fulfilled" ? refundsResult.value.data : [];

  // Aggregate fees in the property's account currency. Stripe returns each
  // fee in the original charge's currency; we sum per-currency to be safe.
  const feesByCurrency = new Map<string, { total: number; count: number }>();
  for (const f of fees) {
    const cur = f.currency.toLowerCase();
    const entry = feesByCurrency.get(cur) ?? { total: 0, count: 0 };
    entry.total += f.amount;
    entry.count++;
    feesByCurrency.set(cur, entry);
  }

  const errors: string[] = [];
  if (accountResult.status === "rejected")
    errors.push(`account: ${describe(accountResult.reason)}`);
  if (feesResult.status === "rejected")
    errors.push(`fees: ${describe(feesResult.reason)}`);
  if (payoutsResult.status === "rejected")
    errors.push(`payouts: ${describe(payoutsResult.reason)}`);
  if (balanceResult.status === "rejected")
    errors.push(`balance: ${describe(balanceResult.reason)}`);
  if (refundsResult.status === "rejected")
    errors.push(`refunds: ${describe(refundsResult.reason)}`);

  return NextResponse.json({
    connected: true,
    account: account
      ? {
          id: account.id,
          country: account.country,
          defaultCurrency: account.default_currency,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          detailsSubmitted: account.details_submitted,
          businessType: account.business_type,
          email: account.email,
          requirements: account.requirements
            ? {
                currentlyDue: account.requirements.currently_due ?? [],
                pastDue: account.requirements.past_due ?? [],
                disabledReason: account.requirements.disabled_reason ?? null,
              }
            : null,
          capabilities: account.capabilities ?? {},
          payouts: {
            schedule: account.settings?.payouts?.schedule ?? null,
          },
        }
      : null,
    platform: {
      // Money you've collected as platform fees from this hotel.
      feesByCurrency: Array.from(feesByCurrency.entries()).map(
        ([currency, v]) => ({
          currency,
          totalMinorUnits: v.total,
          count: v.count,
        })
      ),
      platformFeePercent: property.platformFeePercent,
    },
    hotel: {
      // Hotel-side data — they own this account, you just have read access.
      balance: balance
        ? {
            available: balance.available.map((b) => ({
              amountMinorUnits: b.amount,
              currency: b.currency,
            })),
            pending: balance.pending.map((b) => ({
              amountMinorUnits: b.amount,
              currency: b.currency,
            })),
          }
        : null,
      payouts: payouts.map((p) => ({
        id: p.id,
        amountMinorUnits: p.amount,
        currency: p.currency,
        arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
        status: p.status,
        method: p.method,
      })),
      refunds: refunds.map((r) => ({
        id: r.id,
        amountMinorUnits: r.amount,
        currency: r.currency,
        status: r.status,
        reason: r.reason,
        created: new Date(r.created * 1000).toISOString(),
        paymentIntentId:
          typeof r.payment_intent === "string"
            ? r.payment_intent
            : r.payment_intent?.id ?? null,
      })),
    },
    fromDb: {
      platformFeePercent: property.platformFeePercent,
      payoutSchedule: property.payoutSchedule,
      stripeAccountStatus: property.stripeAccountStatus,
      stripeAccountCurrency: property.stripeAccountCurrency,
    },
    errors: errors.length ? errors : undefined,
  });
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
