import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookingExtras, bookings, properties } from "@/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin-auth";
import { getPmsAdapter } from "@/lib/pms";

// Retry sweep for booking extras that were stored locally but never made it
// to Cloudbeds. The booking flow inserts each extra into booking_extras
// before calling postCustomItem so the row survives a failure (most common
// reason today: the write:item OAuth scope hasn't been granted yet). Once
// the scope is enabled and connected properties re-OAuth, hit this endpoint
// to push every pending row.
//
// Idempotent — only acts on rows with cloudbedsItemId IS NULL whose parent
// booking has a Cloudbeds reservation to attach to.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id: propertyId } = await params;

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (!property.cloudbedsPropertyId) {
    return NextResponse.json(
      { error: "Property is not connected to Cloudbeds" },
      { status: 409 }
    );
  }

  const pending = await db
    .select({
      extraId: bookingExtras.id,
      bookingId: bookings.id,
      cloudbedsReservationId: bookings.cloudbedsReservationId,
      name: bookingExtras.name,
      unitPrice: bookingExtras.unitPrice,
      qty: bookingExtras.qty,
    })
    .from(bookingExtras)
    .innerJoin(bookings, eq(bookingExtras.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.propertyId, propertyId),
        isNull(bookingExtras.cloudbedsItemId),
        isNotNull(bookings.cloudbedsReservationId)
      )
    );

  const pms = getPmsAdapter(property);
  let synced = 0;
  let failed = 0;
  const errors: { extraId: string; message: string }[] = [];

  for (const row of pending) {
    if (!row.cloudbedsReservationId) continue;
    try {
      const { pmsItemId } = await pms.postExtra({
        reservationId: row.cloudbedsReservationId,
        name: row.name,
        amount: Number(row.unitPrice),
        quantity: row.qty,
      });
      if (pmsItemId) {
        await db
          .update(bookingExtras)
          .set({ cloudbedsItemId: pmsItemId })
          .where(eq(bookingExtras.id, row.extraId));
        synced++;
      } else {
        failed++;
        errors.push({ extraId: row.extraId, message: "no itemID returned" });
      }
    } catch (err) {
      failed++;
      errors.push({
        extraId: row.extraId,
        message: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    pending: pending.length,
    synced,
    failed,
    errors: errors.slice(0, 20),
  });
}
