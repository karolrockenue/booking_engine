import { NextRequest, NextResponse } from "next/server";
import { ryftFetch, RyftError } from "@/lib/ryft/client";

// Spike-only: creates a Ryft payment session and returns the clientSecret for
// the Embedded SDK to confirm in the browser. Defaults to a split payment
// routed to the test sub-account with a 10% platform fee.

interface CreateSessionBody {
  amount?: number; // minor units, default £75.00
  currency?: string;
  customerEmail?: string;
  split?: boolean; // route to sub-account + take platform fee
  platformFee?: number; // minor units; defaults to 10% of amount
  captureFlow?: "Automatic" | "Manual";
}

interface RyftSession {
  id: string;
  clientSecret: string;
  status: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CreateSessionBody;
  const amount = body.amount ?? 7500;
  const currency = body.currency ?? "GBP";
  const customerEmail = body.customerEmail ?? "guest@example.com";
  const split = body.split ?? true;

  const subAccount = process.env.RYFT_TEST_SUBACCOUNT_ID ?? null;
  if (split && !subAccount) {
    return NextResponse.json(
      { error: "RYFT_TEST_SUBACCOUNT_ID not configured" },
      { status: 500 }
    );
  }

  const payload: Record<string, unknown> = {
    amount,
    currency,
    customerEmail,
    metadata: { orderId: `spike-${Date.now()}` },
  };
  if (body.captureFlow) payload.captureFlow = body.captureFlow;
  if (split) payload.platformFee = body.platformFee ?? Math.round(amount * 0.1);

  try {
    const session = await ryftFetch<RyftSession>("/payment-sessions", {
      method: "POST",
      body: payload,
      account: split ? subAccount : undefined,
    });
    return NextResponse.json({
      clientSecret: session.clientSecret,
      paymentSessionId: session.id,
      status: session.status,
      accountId: split ? subAccount : null,
      publicKey: process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY ?? null,
    });
  } catch (err) {
    if (err instanceof RyftError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Ryft session create failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
