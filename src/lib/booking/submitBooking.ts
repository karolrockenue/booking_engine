import type { AvailabilityResult, Extra, GuestDetails } from "./types";

export interface SubmitBookingArgs {
  propertyId: string;
  result: AvailabilityResult;
  extras: Extra[]; // full extra objects for the selected IDs
  guest: GuestDetails;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
  // Slots reserved for Step 10/11 (Stripe). Today's /api/bookings ignores
  // these; once Stripe lands we'll forward them on the request body.
  paymentIntentId?: string;
  setupIntentId?: string;
  paymentMethodId?: string;
  customerId?: string;
}

export interface SubmitBookingResult {
  orderId: string;
  bookingId: string;
  cloudbedsReservationId?: string;
}

export class SubmitBookingError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "SubmitBookingError";
  }
}

export async function submitBooking(
  args: SubmitBookingArgs
): Promise<SubmitBookingResult> {
  const extrasTotal = args.extras.reduce(
    (sum, e) => sum + e.priceMinorUnits / 100,
    0
  );
  const totalPrice = args.result.totalPrice + extrasTotal;

  const body = {
    propertyId: args.propertyId,
    roomTypeId: args.result.roomType.id,
    ratePlanId: args.result.ratePlan.id,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    adults: args.adults,
    children: args.children,
    guestFirst: args.guest.firstName,
    guestLast: args.guest.lastName,
    guestEmail: args.guest.email,
    guestPhone: args.guest.phone || undefined,
    guestCountry: args.guest.country || undefined,
    nightlyRates: args.result.nightlyRates,
    totalPrice,
    currency: args.currency,
    // Forward Stripe IDs once they exist. /api/bookings discards extras for
    // now — Step 11 picks them up.
    extras: args.extras.map((e) => ({
      id: e.id,
      name: e.name,
      priceMinorUnits: e.priceMinorUnits,
      currency: e.currency,
    })),
    paymentIntentId: args.paymentIntentId,
    setupIntentId: args.setupIntentId,
    paymentMethodId: args.paymentMethodId,
    customerId: args.customerId,
  };

  const res = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    orderId?: string;
    bookingId?: string;
    cloudbedsReservationId?: string;
  };

  if (!res.ok || !data.orderId || !data.bookingId) {
    throw new SubmitBookingError(
      data.error ?? `Booking submission failed (${res.status})`,
      res.status
    );
  }

  return {
    orderId: data.orderId,
    bookingId: data.bookingId,
    cloudbedsReservationId: data.cloudbedsReservationId,
  };
}
