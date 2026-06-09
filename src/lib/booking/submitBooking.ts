import { extrasSubtotal } from "./extra-pricing";
import type {
  AvailabilityResult,
  Extra,
  ExtraConfig,
  GuestDetails,
} from "./types";

export interface SubmitBookingArgs {
  propertyId: string;
  orderId: string; // client-generated UUID, same one used as Stripe idempotency key + metadata
  result: AvailabilityResult;
  extras: Extra[]; // full extra objects for the selected IDs
  extrasConfig?: Record<string, ExtraConfig>; // per-extra guest options (breakfast)
  guest: GuestDetails;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
  paymentIntentId?: string;
  setupIntentId?: string;
  paymentMethodId?: string;
  customerId?: string;
}

export interface SubmitBookingResult {
  orderId: string;
  bookingId: string;
  cloudbedsReservationId?: string;
  cancelUrl?: string; // Flex self-cancel link, for the confirmation screen
}

export class SubmitBookingError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "SubmitBookingError";
  }
}

// --- Step 0b: create-before-pay -------------------------------------------
//
// The checkout now persists the booking server-side BEFORE the card is charged,
// so fulfilment never depends on the browser surviving:
//   1. initBooking()         — on email entry: creates the pending row + extras
//                              intent + the Stripe intent. Returns bookingId +
//                              clientSecret.
//   2. patchBookingDetails() — on submit, BEFORE confirming the card: writes the
//                              guest name/country onto the row. Throws on
//                              failure so we never charge a card we couldn't
//                              attach details to (the durability invariant).
//   3. submitBooking()       — after the card confirms: verifies + fulfils.

export interface InitBookingArgs {
  propertyId: string;
  orderId: string;
  result: AvailabilityResult;
  extras: Extra[];
  extrasConfig?: Record<string, ExtraConfig>;
  guestEmail: string;
  guestFirst?: string;
  guestLast?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  currency: string;
}

export interface InitBookingResult {
  bookingId: string;
  clientSecret: string;
  paymentIntentId?: string;
  setupIntentId?: string;
  customerId?: string;
}

export async function initBooking(
  args: InitBookingArgs
): Promise<InitBookingResult> {
  const extrasTotal = extrasSubtotal(
    args.extras,
    args.extras.map((e) => e.id),
    args.result.nights,
    args.adults + args.children,
    args.extrasConfig
  );
  const totalPrice = args.result.totalPrice + extrasTotal;

  const body = {
    propertyId: args.propertyId,
    orderId: args.orderId,
    roomTypeId: args.result.roomType.id,
    ratePlanId: args.result.ratePlan.id,
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    adults: args.adults,
    children: args.children,
    guestEmail: args.guestEmail,
    guestFirst: args.guestFirst || undefined,
    guestLast: args.guestLast || undefined,
    nightlyRates: args.result.nightlyRates,
    totalPrice,
    currency: args.currency,
    extras: args.extras.map((e) => ({
      id: e.id,
      name: e.name,
      priceMinorUnits: e.priceMinorUnits,
      currency: e.currency,
      config: args.extrasConfig?.[e.id],
    })),
  };

  const res = await fetch("/api/bookings/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    bookingId?: string;
    clientSecret?: string;
    paymentIntentId?: string;
    setupIntentId?: string;
    customerId?: string;
  };

  if (!res.ok || !data.bookingId || !data.clientSecret) {
    throw new SubmitBookingError(
      data.error ?? `Failed to initialise payment (${res.status})`,
      res.status
    );
  }

  return {
    bookingId: data.bookingId,
    clientSecret: data.clientSecret,
    paymentIntentId: data.paymentIntentId,
    setupIntentId: data.setupIntentId,
    customerId: data.customerId,
  };
}

// Persist guest details onto the pending row BEFORE the card is confirmed.
// Throws on failure: we'd rather block checkout than take money against a row
// the webhook couldn't fulfil (missing name/country).
export async function patchBookingDetails(
  bookingId: string,
  guest: GuestDetails
): Promise<void> {
  const res = await fetch(`/api/bookings/${bookingId}/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      guestFirst: guest.firstName,
      guestLast: guest.lastName,
      guestEmail: guest.email,
      guestPhone: guest.phone || undefined,
      guestCountry: guest.country || undefined,
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new SubmitBookingError(
      data.error ?? `Could not save guest details (${res.status})`,
      res.status
    );
  }
}

export async function submitBooking(
  args: SubmitBookingArgs
): Promise<SubmitBookingResult> {
  const extrasTotal = extrasSubtotal(
    args.extras,
    args.extras.map((e) => e.id),
    args.result.nights,
    args.adults + args.children,
    args.extrasConfig
  );
  const totalPrice = args.result.totalPrice + extrasTotal;

  const body = {
    propertyId: args.propertyId,
    orderId: args.orderId,
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
      config: args.extrasConfig?.[e.id],
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
    cancelUrl?: string;
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
    cancelUrl: data.cancelUrl,
  };
}
