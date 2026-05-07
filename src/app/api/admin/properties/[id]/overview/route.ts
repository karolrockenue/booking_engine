import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties, bookings, roomTypes, ratePlans } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const FOURTEEN_DAYS_MS = 14 * DAY_MS;

type ChecklistItem = { id: string; label: string; done: boolean; meta?: string };
type AlertItem = {
  id: string;
  kind: "danger" | "warn" | "info";
  title: string;
  desc: string;
  cta?: { label: string; href?: string };
};

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

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
  const fourteenDaysAgo = new Date(now.getTime() - FOURTEEN_DAYS_MS);

  const [windowBookings, recentList] = await Promise.all([
    db
      .select({
        createdAt: bookings.createdAt,
        grandTotal: bookings.grandTotal,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.propertyId, id),
          gte(bookings.createdAt, fourteenDaysAgo)
        )
      ),
    db
      .select({
        id: bookings.id,
        orderId: bookings.orderId,
        cloudbedsReservationId: bookings.cloudbedsReservationId,
        guestFirst: bookings.guestFirst,
        guestLast: bookings.guestLast,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        grandTotal: bookings.grandTotal,
        currency: bookings.currency,
        status: bookings.status,
        rateType: bookings.rateType,
        createdAt: bookings.createdAt,
        roomTypeName: roomTypes.name,
        ratePlanName: ratePlans.name,
      })
      .from(bookings)
      .leftJoin(roomTypes, eq(bookings.roomTypeId, roomTypes.id))
      .leftJoin(ratePlans, eq(bookings.ratePlanId, ratePlans.id))
      .where(eq(bookings.propertyId, id))
      .orderBy(desc(bookings.createdAt))
      .limit(5),
  ]);

  // ─── stats: 7d vs prior 7d, daily series, avg booking, avg nights ───
  const isCounted = (s: string | null) =>
    s !== "failed" && s !== "cancelled";

  let bookings7d = 0;
  let bookings7dPrior = 0;
  let revenue7d = 0;
  let revenue7dPrior = 0;
  let nights7dSum = 0;
  const dailyCounts = Array(7).fill(0) as number[];
  const dailyRevenue = Array(7).fill(0) as number[];

  for (const b of windowBookings) {
    if (!b.createdAt) continue;
    if (!isCounted(b.status)) continue;
    const ms = b.createdAt.getTime();
    const total = Number(b.grandTotal);

    if (ms >= sevenDaysAgo.getTime()) {
      bookings7d++;
      revenue7d += total;
      const inDate = new Date(b.checkIn);
      const outDate = new Date(b.checkOut);
      const nights = Math.max(
        1,
        Math.round((outDate.getTime() - inDate.getTime()) / DAY_MS)
      );
      nights7dSum += nights;

      const daysAgo = Math.floor((now.getTime() - ms) / DAY_MS);
      if (daysAgo >= 0 && daysAgo < 7) {
        const idx = 6 - daysAgo; // 0 = oldest of last 7, 6 = today
        dailyCounts[idx]++;
        dailyRevenue[idx] += total;
      }
    } else {
      bookings7dPrior++;
      revenue7dPrior += total;
    }
  }

  const avgBooking = bookings7d > 0 ? revenue7d / bookings7d : 0;
  const avgNights = bookings7d > 0 ? nights7dSum / bookings7d : 0;
  const bookingsDelta = bookings7d - bookings7dPrior;
  const revenueDeltaPct =
    revenue7dPrior > 0 ? ((revenue7d - revenue7dPrior) / revenue7dPrior) * 100 : null;

  // ─── checklist (only items derivable today; later tabs unlock more) ───
  const checklist: ChecklistItem[] = [
    {
      id: "property_created",
      label: "Property created",
      done: true,
      meta: property.createdAt ? formatDateMeta(property.createdAt) : undefined,
    },
    {
      id: "cloudbeds_oauth",
      label: "Cloudbeds connected",
      done: !!property.cloudbedsAccessToken && !!property.cloudbedsPropertyId,
      meta: property.cloudbedsTokenExpiresAt
        ? `token to ${formatDateMeta(property.cloudbedsTokenExpiresAt)}`
        : undefined,
    },
    {
      id: "stripe_connect",
      label: "Stripe Connect onboarded",
      done: property.stripeAccountStatus === "active",
      meta: property.stripeAccountStatus
        ? `status ${property.stripeAccountStatus}`
        : "not started",
    },
    {
      id: "domain_set",
      label: "Domain configured",
      done: !!property.domain,
      meta: property.domain ?? "not set",
    },
    {
      id: "first_booking",
      label: "First booking placed",
      done: recentList.length > 0,
      meta:
        recentList.length > 0 && recentList[0].createdAt
          ? formatDateMeta(recentList[0].createdAt)
          : undefined,
    },
  ];

  // ─── alerts (basic derivations until the alerts engine lands) ───
  const alerts: AlertItem[] = [];

  if (property.stripeAccountStatus === "restricted") {
    alerts.push({
      id: "stripe_restricted",
      kind: "danger",
      title: "Stripe account is restricted",
      desc:
        "Stripe has restricted this connected account. Charges may fail. Open Stripe to resolve outstanding requirements.",
      cta: { label: "Open in Stripe ↗" },
    });
  }

  if (
    property.cloudbedsPropertyId &&
    !property.cloudbedsAccessToken
  ) {
    alerts.push({
      id: "cloudbeds_reauth",
      kind: "danger",
      title: "Cloudbeds token missing",
      desc: "A Cloudbeds property is linked but no auth token is stored. Re-authorise to restore the connection.",
      cta: { label: "Re-authorise" },
    });
  }

  if (property.cloudbedsTokenExpiresAt) {
    const msToExpiry = property.cloudbedsTokenExpiresAt.getTime() - now.getTime();
    if (msToExpiry > 0 && msToExpiry < SEVEN_DAYS_MS) {
      const days = Math.ceil(msToExpiry / DAY_MS);
      alerts.push({
        id: "cloudbeds_token_expiring",
        kind: "warn",
        title: `Cloudbeds token expires in ${days} day${days === 1 ? "" : "s"}`,
        desc: "Auto-refresh should handle it, but worth a glance if syncs start failing.",
      });
    }
  }

  const failed7d = windowBookings.filter(
    (b) => b.status === "failed" && b.createdAt && b.createdAt >= sevenDaysAgo
  ).length;
  if (failed7d > 0) {
    alerts.push({
      id: "failed_bookings",
      kind: "warn",
      title: `${failed7d} failed booking${failed7d === 1 ? "" : "s"} in 7 days`,
      desc: "Stripe verification or postReservation failed. Review on Bookings tab.",
    });
  }

  return NextResponse.json({
    property: {
      id: property.id,
      slug: property.slug,
      name: property.name,
      domain: property.domain,
      currency: property.currency,
      status: property.status,
      stripeAccountId: property.stripeAccountId,
      stripeAccountStatus: property.stripeAccountStatus,
      cloudbedsConnected: !!property.cloudbedsAccessToken,
      cloudbedsPropertyId: property.cloudbedsPropertyId,
    },
    stats: {
      bookings7d,
      bookings7dPrior,
      bookingsDelta,
      revenue7d,
      revenue7dPrior,
      revenueDeltaPct,
      avgBooking,
      avgNights,
      dailyCounts,
      dailyRevenue,
    },
    recentBookings: recentList,
    checklist,
    alerts,
  });
}

function formatDateMeta(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
