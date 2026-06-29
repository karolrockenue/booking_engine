import { extrasSubtotal } from "./extra-pricing";
import type {
  AvailabilityResult,
  Extra,
  ExtraConfig,
  GuestDetails,
} from "./types";

export class SubmitBookingError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "SubmitBookingError";
  }
}

// --- create-before-pay -----------------------------------------------------
//
// The checkout persists the booking server-side BEFORE the card is charged, so
// fulfilment never depends on the browser surviving:
//   1. ryftInitBooking()     — on email entry: creates the pending row + extras
//                              intent + the Ryft session. Returns bookingId +
//                              clientSecret.
//   2. patchBookingDetails() — on submit, BEFORE confirming the card: writes the
//                              guest name/country onto the row. Throws on
//                              failure so we never charge a card we couldn't
//                              attach details to (the durability invariant).
//   3. ryftFinaliseBooking() — after the card confirms: verifies + fulfils.

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

// ── Ryft rail ──────────────────────────────────────────────────────────────
// Create-before-pay on the Ryft rail: NR opens a pay-now session, Flex opens a
// zero-value card-save (COF mandate) session — the server decides by rate type.

export interface RyftInitBookingResult {
  bookingId: string;
  clientSecret: string;
  paymentSessionId: string;
  accountId: string | null;
  publicKey: string | null;
  status: string;
}

export async function ryftInitBooking(
  args: InitBookingArgs
): Promise<RyftInitBookingResult> {
  const extrasTotal = extrasSubtotal(
    args.extras,
    args.extras.map((e) => e.id),
    args.result.nights,
    args.adults + args.children,
    args.extrasConfig
  );
  const totalPrice = args.result.totalPrice + extrasTotal;

  const res = await fetch("/api/ryft/booking-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    bookingId?: string;
    clientSecret?: string;
    paymentSessionId?: string;
    accountId?: string | null;
    publicKey?: string | null;
    status?: string;
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
    paymentSessionId: data.paymentSessionId ?? "",
    accountId: data.accountId ?? null,
    publicKey: data.publicKey ?? null,
    status: data.status ?? "PendingPayment",
  };
}

// Inline finalise after the guest confirms the card: verifies the Ryft session
// is paid server-side and fulfils to the PMS. Returns the reservation id for
// the confirmation page (the webhook is the async backstop).
export async function ryftFinaliseBooking(bookingId: string): Promise<{
  orderId?: string;
  cloudbedsReservationId?: string | null;
  outcome?: string;
  cancelUrl?: string; // Flex self-cancel link, for the confirmation screen
}> {
  const res = await fetch("/api/ryft/booking-finalise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    orderId?: string;
    cloudbedsReservationId?: string | null;
    outcome?: string;
    cancelUrl?: string;
  };
  if (!res.ok) {
    throw new SubmitBookingError(
      data.error ?? `Could not finalise booking (${res.status})`,
      res.status
    );
  }
  return data;
}
