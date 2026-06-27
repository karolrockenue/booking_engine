import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateSessionEmail } from "@/lib/ryft/sessions";

// Patch the guest details onto a create-before-pay booking BEFORE the card is
// confirmed (Step 0b ordering invariant). At init time we only had the email;
// the name/country/phone are typed later, and fulfilment needs them (Mews
// requires LastName, Cloudbeds an ISO country). The client calls this right
// before stripeForm.confirm() so that if the tab dies post-charge, the webhook
// has everything it needs to fulfil.
//
// Guarded to status "pending": once the booking is finalised (paid /
// payment_authorized / pms_synced) its details are locked — a late patch must
// not rewrite the guest on an already-created reservation. Idempotent.

interface DetailsBody {
  guestFirst?: string;
  guestLast?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCountry?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as DetailsBody;

  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      propertyId: bookings.propertyId,
      ryftPaymentSessionId: bookings.ryftPaymentSessionId,
      ryftVerifySessionId: bookings.ryftVerifySessionId,
    })
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Already finalised — details are locked. No-op so a retried submit is safe.
  if (booking.status !== "pending") {
    return NextResponse.json({ ok: true, patched: false });
  }

  const patch: Partial<typeof bookings.$inferInsert> = {};
  if (body.guestFirst !== undefined) patch.guestFirst = body.guestFirst;
  if (body.guestLast !== undefined) patch.guestLast = body.guestLast;
  if (body.guestEmail) patch.guestEmail = body.guestEmail;
  if (body.guestPhone !== undefined) patch.guestPhone = body.guestPhone || null;
  if (body.guestCountry !== undefined)
    patch.guestCountry = body.guestCountry || null;

  if (Object.keys(patch).length > 0) {
    await db.update(bookings).set(patch).where(eq(bookings.id, id));
  }

  // Ryft refuses to action a payment unless the session carries customerEmail,
  // and the storefront creates the session before the email is typed — so push
  // it onto the session now, just before the card is confirmed. NR uses the
  // pay-now session; Flex uses the card-save (verify) session — patch whichever
  // this booking has.
  const ryftSessionId =
    booking.ryftPaymentSessionId ?? booking.ryftVerifySessionId;
  if (body.guestEmail && ryftSessionId && booking.propertyId) {
    try {
      const [property] = await db
        .select({ ryftAccountId: properties.ryftAccountId })
        .from(properties)
        .where(eq(properties.id, booking.propertyId))
        .limit(1);
      if (property?.ryftAccountId) {
        await updateSessionEmail(
          ryftSessionId,
          property.ryftAccountId,
          body.guestEmail
        );
      }
    } catch (err) {
      console.error(`Ryft session email patch failed for ${id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, patched: true });
}
