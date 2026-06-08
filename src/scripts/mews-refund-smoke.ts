// §7.4 verification — the compensating external-payment reversal, through the
// REAL adapter (getPmsAdapter → MewsAdapter.recordRefund). Mirrors the cancel
// route order: create → recordPayment(+) → cancelReservation → recordRefund(−),
// then polls payments/getAll and asserts the folio nets to zero. Self-cleaning.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-refund-smoke.ts

import { db } from "../db";
import {
  properties,
  roomTypes,
  ratePlans,
  mewsCategoryAvailability,
  mewsRatePrices,
  contentBlocks,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { encryptToken } from "../lib/crypto";
import { fetchMewsConnectionInfo } from "../lib/pms/mews/config";
import { getMewsCredentials } from "../lib/pms/mews/credentials";
import { mews, mewsPaginated } from "../lib/pms/mews/client";
import { getPmsAdapter } from "../lib/pms";

const SLUG = "mews-refund-smoke";

async function cleanup(propertyId: string) {
  await db.delete(mewsRatePrices).where(eq(mewsRatePrices.propertyId, propertyId));
  await db
    .delete(mewsCategoryAvailability)
    .where(eq(mewsCategoryAvailability.propertyId, propertyId));
  await db.delete(ratePlans).where(eq(ratePlans.propertyId, propertyId));
  await db.delete(roomTypes).where(eq(roomTypes.propertyId, propertyId));
  await db.delete(contentBlocks).where(eq(contentBlocks.propertyId, propertyId));
  await db.delete(properties).where(eq(properties.id, propertyId));
}

async function reservationAccountId(
  accessToken: string,
  reservationId: string
): Promise<string> {
  const resp = await mews<{
    Reservations?: Array<{ CustomerId?: string; AccountId?: string }>;
  }>("reservations/getAll/2023-06-06", accessToken, {
    ReservationIds: [reservationId],
    Limitation: { Count: 1 },
  });
  const r = resp.Reservations?.[0];
  const id = r?.AccountId ?? r?.CustomerId;
  if (!id) throw new Error(`No AccountId for reservation ${reservationId}`);
  return id;
}

interface PaymentRow {
  Amount?: { GrossValue?: number; NetValue?: number; Value?: number };
}

async function netPayments(
  accessToken: string,
  accountId: string
): Promise<{ count: number; net: number }> {
  const rows = await mewsPaginated<PaymentRow>(
    "payments/getAll",
    accessToken,
    { AccountIds: [accountId] },
    "Payments",
    1000
  );
  let net = 0;
  for (const p of rows) {
    const a = p.Amount ?? {};
    net += a.Value ?? a.GrossValue ?? a.NetValue ?? 0;
  }
  return { count: rows.length, net: Math.round(net * 100) / 100 };
}

async function main() {
  const token = process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  const [stale] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, SLUG))
    .limit(1);
  if (stale) await cleanup(stale.id);

  const info = await fetchMewsConnectionInfo(token);
  const service =
    info.services.find((s) => s.name === "Accommodation (real)") ?? info.services[0];
  if (!service) throw new Error("No Reservable service on demo enterprise");
  const externalPaymentType = info.externalPaymentTypes[0] ?? "Cash";

  const [property] = await db
    .insert(properties)
    .values({
      slug: SLUG,
      name: "Mews Refund Smoke",
      theme: {},
      pmsType: "mews",
      timezone: info.timezone || "Europe/London",
      currency: info.currency || "GBP",
      pmsCredentials: {
        accessTokenEnc: encryptToken(token),
        serviceId: service.id,
        timezone: info.timezone,
        enterpriseId: info.enterpriseId,
        taxMode: info.taxMode,
        externalPaymentType,
        currency: info.currency,
      },
    })
    .returning();

  const propertyId = property.id;
  const adapter = getPmsAdapter(property);
  const creds = await getMewsCredentials(propertyId);
  let reservationId: string | undefined;
  let pass = false;

  try {
    await adapter.syncInventory(30);
    const ci = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    const co = new Date(Date.now() + 23 * 864e5).toISOString().slice(0, 10);
    const opt = (await adapter.getAvailability(ci, co, 1)).find((o) => o.totalPrice > 0);
    if (!opt) throw new Error("No bookable option found in window");
    const total = opt.totalPrice;

    const created = await adapter.createReservation({
      startDate: ci,
      endDate: co,
      guestFirstName: "Refund",
      guestLastName: "Smoke",
      guestEmail: `refundsmoke+${Date.now()}@example.com`,
      guestCountry: "GB",
      roomTypeId: opt.roomType.otaRoomId,
      rateId: opt.ratePlan.otaRateId,
      adults: 1,
      children: 0,
      roomSubtotal: total,
      orderId: `refundsmoke-${Date.now()}`,
      nightlyRates: opt.nightlyRates,
    });
    reservationId = created.pmsReservationId;
    console.log(`✓ reservation ${reservationId} (total ${total})`);

    // Charge record (the original external payment).
    await adapter.recordPayment({
      reservationId,
      amount: total,
      type: externalPaymentType,
      description: "Stripe pi_refundsmoke",
      externalIdentifier: "pi_refundsmoke",
    });
    console.log(`✓ recordPayment +${total}`);

    // Cancel order matches the real cancel route: cancel reservation first…
    await adapter.cancelReservation({ reservationId, reason: "refund smoke" });
    console.log("✓ cancelReservation");

    // …then post the compensating reversal via the REAL adapter method.
    const reversal = await adapter.recordRefund({
      reservationId,
      amount: total,
      externalIdentifier: "re_refundsmoke",
      description: "Stripe refund re_refundsmoke",
    });
    console.log(`✓ recordRefund → ${reversal?.pmsRefundId}`);
    if (!reversal) throw new Error("recordRefund returned null on a Mews property");

    const accountId = await reservationAccountId(creds.accessToken, reservationId);
    let ledger = { count: 0, net: NaN };
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      ledger = await netPayments(creds.accessToken, accountId);
      if (ledger.count >= 2) break;
      console.log(`  …waiting for reversal to surface (count ${ledger.count})`);
    }
    console.log(`  ledger: ${ledger.count} payments, net ${ledger.net}`);
    if (ledger.count >= 2 && ledger.net === 0) {
      pass = true;
      console.log("\n✅ PASS — folio reconciles to zero after refund reversal.");
    } else {
      console.log("\n❌ FAIL — folio did not net to zero.");
    }
  } finally {
    if (reservationId) {
      try {
        await adapter.cancelReservation({ reservationId, reason: "refund smoke cleanup" });
      } catch {
        /* already cancelled */
      }
    }
    await cleanup(propertyId);
    console.log("Cleaned up throwaway property.");
  }

  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("\nSMOKE CRASHED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
