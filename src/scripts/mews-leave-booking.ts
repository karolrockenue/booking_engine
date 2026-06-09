// Creates a PERSISTENT Mews booking on the gross demo enterprise so it can be
// viewed in Commander (app.mews-demo.com). Unlike the smokes, it does NOT cancel.
// Books on the "Accommodation (real)" service. Cleans up only the throwaway DB
// property — the Mews reservation is left standing for visual inspection.
//
//   set -a && source .env.local && set +a && npx tsx src/scripts/mews-leave-booking.ts
//
// To remove it afterwards: cancel it from Commander, or re-run mews-write-smoke.

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
import { getPmsAdapter } from "../lib/pms";
import { mews } from "../lib/pms/mews/client";

const SLUG = "mews-view-booking";
// Override via env to target a different demo enterprise/service the viewer can
// actually see in Commander (e.g. the Net enterprise).
const SERVICE_NAME = process.env.MEWS_VIEW_SERVICE || "Accommodation (real)";

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

async function fetchNumber(token: string, reservationId: string): Promise<string | undefined> {
  // reservations/getAll has read-after-write lag — poll a few times.
  for (let i = 0; i < 6; i++) {
    try {
      const resp = await mews<{ Reservations?: Array<{ Id?: string; Number?: string }> }>(
        "reservations/getAll/2023-06-06",
        token,
        { ReservationIds: [reservationId], Limitation: { Count: 10 } }
      );
      const r = resp.Reservations?.find((x) => x.Id === reservationId);
      if (r?.Number) return r.Number;
    } catch {
      /* ignore + retry */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return undefined;
}

async function main() {
  const token = process.env.MEWS_VIEW_TOKEN || process.env.MEWS_DEMO_ACCESS_TOKEN;
  if (!token) throw new Error("MEWS_DEMO_ACCESS_TOKEN not set");

  const [existing] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.slug, SLUG))
    .limit(1);
  if (existing) await cleanup(existing.id);

  const info = await fetchMewsConnectionInfo(token);
  const service =
    info.services.find((s) => s.name === SERVICE_NAME) ?? info.services[0];
  if (!service) throw new Error("No Reservable service on demo enterprise");

  const [property] = await db
    .insert(properties)
    .values({
      slug: SLUG,
      name: "Mews View Booking",
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
        externalPaymentType: info.externalPaymentTypes[0] ?? "Cash",
        currency: info.currency,
      },
    })
    .returning();

  const propertyId = property.id;
  const adapter = getPmsAdapter(property);

  try {
    console.log(`Service: ${service.name} (${service.id})`);
    console.log("Syncing inventory (30 days)...");
    await adapter.syncInventory(30);

    const ci = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const co = new Date(Date.now() + 16 * 864e5).toISOString().slice(0, 10);
    const options = await adapter.getAvailability(ci, co, 1);
    const opt = options.find((o) => o.totalPrice > 0);
    if (!opt) throw new Error("No bookable option found in window");

    const guestLast = `ROCKENUE-DEMO-${new Date(Date.now()).toISOString().slice(0, 10)}`;
    const created = await adapter.createReservation({
      startDate: ci,
      endDate: co,
      guestFirstName: "Karol",
      guestLastName: guestLast,
      guestEmail: `view+${Date.now()}@rockenue.test`,
      guestCountry: "GB",
      roomTypeId: opt.roomType.otaRoomId,
      rateId: opt.ratePlan.otaRateId,
      adults: 1,
      children: 0,
      roomSubtotal: opt.totalPrice,
      orderId: `view-${Date.now()}`,
      nightlyRates: opt.nightlyRates,
    });

    const pay = await adapter.recordPayment({
      reservationId: created.pmsReservationId,
      amount: opt.totalPrice,
      type: "Cash",
      description: "Stripe pi_view_demo (left for inspection)",
      externalIdentifier: "pi_view_demo",
    });

    const number = await fetchNumber(token, created.pmsReservationId);

    console.log("\n========= BOOKING LEFT STANDING IN MEWS =========");
    console.log(`Enterprise:    ${info.enterpriseId}  (API Hotel Gross Pricing)`);
    console.log(`Service:       ${service.name}`);
    console.log(`Reservation #: ${number ?? "(lagged — search by guest name)"}`);
    console.log(`Reservation Id:${created.pmsReservationId}`);
    console.log(`Guest:         Karol ${guestLast}`);
    console.log(`Dates:         ${ci} → ${co} (2 nights)`);
    console.log(`Room · Rate:   ${opt.roomType.name} · ${opt.ratePlan.name}`);
    console.log(`Total:         ${opt.totalPrice} ${info.currency}`);
    console.log(`Ext. payment:  ${pay.pmsPaymentId} (Cash, recorded)`);
    console.log("=================================================");
    console.log("\nIn Commander: open the timeline for 'Accommodation (real)',");
    console.log(`jump to ${ci}, or search reservations by guest 'ROCKENUE-DEMO'.`);
  } finally {
    console.log("\nRemoving throwaway DB property (Mews reservation stays)...");
    await cleanup(propertyId);
    console.log("Done.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nFAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
