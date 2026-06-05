// Mews write path (Phase 4): customer → reservation → external payment →
// cancel, plus extras and notes. All Mews-specific request shaping lives here;
// the MewsAdapter is a thin wrapper. Verified against api.mews-demo.com
// (src/scripts/mews-probe-writes.ts).
//
// Money model (plan §7): Stripe Connect collects; we only RECORD the charge in
// Mews via payments/addExternal. Prices sent to Mews are the exact per-night
// amounts charged via Stripe (TimeUnitPrices + CheckRateApplicability:false), so
// the Mews folio matches Stripe to the cent.

import { mews, mewsPaginated } from "./client";
import { toMewsUtc } from "./timezone";
import type { MewsCredentials } from "./credentials";

// 0-based local nights between check-in and check-out (excludes departure day).
function nights(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const end = new Date(`${checkOut}T00:00:00Z`);
  for (
    let d = new Date(`${checkIn}T00:00:00Z`);
    d < end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// --- age categories -----------------------------------------------------

interface AgeCategory {
  Id: string;
  Classification?: string;
  IsActive?: boolean;
}

// Adult AgeCategoryId for PersonCounts. Mews requires a real age category id;
// every accommodation service has an "Adult" classification.
async function getAdultAgeCategoryId(
  creds: MewsCredentials
): Promise<string> {
  const resp = await mews<{ AgeCategories?: AgeCategory[] }>(
    "ageCategories/getAll",
    creds.accessToken,
    { ServiceIds: [creds.serviceId] }
  );
  const cats = (resp.AgeCategories ?? []).filter((a) => a.IsActive !== false);
  const adult =
    cats.find((a) => a.Classification === "Adult") ?? cats[0];
  if (!adult) throw new Error("Mews: no age category found for service");
  return adult.Id;
}

// --- pricing metadata (tax codes + currency) ----------------------------

interface PricingAmount {
  Currency?: string;
  TaxValues?: Array<{ Code?: string }>;
}
interface PricingResponse {
  TimeUnitStartsUtc?: string[];
  BaseAmountPrices?: PricingAmount[];
  CategoryPrices?: Array<{ CategoryId: string; AmountPrices: PricingAmount[] }>;
}

// Mews rejects TimeUnitPrices whose Amount has no/invalid TaxCodes ("Invalid
// TaxCodes"). The tax codes (and the rate's currency) come straight from
// rates/getPricing for the same rate+category+nights — we send our Stripe price
// as GrossValue but Mews's own tax codes so the split is valid. Returns the
// currency and a per-night list of tax codes (carrying the last non-empty set
// forward if a night is missing).
async function getStayPricingMeta(
  creds: MewsCredentials,
  rateId: string,
  categoryId: string,
  stayNights: string[]
): Promise<{ currency: string; taxCodesByNight: string[][] }> {
  const first = stayNights[0];
  const last = stayNights[stayNights.length - 1];
  const pricing = await mews<PricingResponse>(
    "rates/getPricing",
    creds.accessToken,
    {
      RateId: rateId,
      FirstTimeUnitStartUtc: toMewsUtc(first, creds.timezone),
      LastTimeUnitStartUtc: toMewsUtc(last, creds.timezone),
    }
  );
  const cat = (pricing.CategoryPrices ?? []).find(
    (c) => c.CategoryId === categoryId
  );
  const amounts = cat?.AmountPrices ?? pricing.BaseAmountPrices ?? [];

  let currency = creds.currency;
  let lastCodes: string[] = [];
  const taxCodesByNight = stayNights.map((_, i) => {
    const a = amounts[i];
    if (a?.Currency) currency = a.Currency;
    const codes = (a?.TaxValues ?? [])
      .map((tv) => tv.Code)
      .filter((c): c is string => !!c);
    if (codes.length > 0) lastCodes = codes;
    return codes.length > 0 ? codes : lastCodes;
  });
  return { currency, taxCodesByNight };
}

// --- customers ----------------------------------------------------------

export interface MewsGuest {
  firstName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationalityCode?: string;
}

// Find an existing customer by email (dedupe) or create one. customers/add
// enforces email uniqueness, so a repeat guest MUST be reused. The email lookup
// (customers/getAll filtered by Emails) is CQ-2-gated in production: if the
// scope is withheld it throws, and we fall back to a blind add — degrading
// gracefully (a brand-new email still works; only a repeat email without the
// scope would fail, which is the documented trade-off).
async function findOrCreateCustomer(
  creds: MewsCredentials,
  guest: MewsGuest
): Promise<string> {
  if (guest.email) {
    try {
      const existing = await mewsPaginated<{ Id?: string }>(
        "customers/getAll",
        creds.accessToken,
        { Emails: [guest.email] },
        "Customers",
        100
      );
      if (existing[0]?.Id) return existing[0].Id;
    } catch {
      // customers/getAll not granted (CQ-2) — fall through to add.
    }
  }

  const added = await mews<{ Id?: string; CustomerId?: string }>(
    "customers/add",
    creds.accessToken,
    {
      LastName: guest.lastName,
      FirstName: guest.firstName,
      Email: guest.email,
      Phone: guest.phone,
      NationalityCode: guest.nationalityCode,
    }
  );
  const id = added.Id ?? added.CustomerId;
  if (!id) throw new Error("Mews customers/add returned no Id");
  return id;
}

// --- reservation create -------------------------------------------------

export interface CreateMewsReservationInput {
  orderId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  categoryId: string; // RequestedCategoryId (room_types.ota_room_id)
  rateId: string; // RateId (rate_plans.ota_rate_id)
  adults: number;
  guest: MewsGuest;
  // Exact per-night prices charged via Stripe, in stay order. Length must equal
  // the number of nights. These become TimeUnitPrices (Index 0..n-1).
  nightlyRates: number[];
  notes?: string;
}

export interface CreateMewsReservationResult {
  pmsReservationId: string;
  pmsGroupId?: string;
  customerId: string;
}

export async function createMewsReservation(
  creds: MewsCredentials,
  input: CreateMewsReservationInput
): Promise<CreateMewsReservationResult> {
  const stayNights = nights(input.startDate, input.endDate);
  if (stayNights.length === 0) throw new Error("Mews: empty stay range");
  if (input.nightlyRates.length !== stayNights.length) {
    throw new Error(
      `Mews: nightlyRates (${input.nightlyRates.length}) != nights (${stayNights.length})`
    );
  }

  const [ageCategoryId, customerId, pricingMeta] = await Promise.all([
    getAdultAgeCategoryId(creds),
    findOrCreateCustomer(creds, input.guest),
    getStayPricingMeta(creds, input.rateId, input.categoryId, stayNights),
  ]);

  const isNet = creds.taxMode === "Net";
  const timeUnitPrices = input.nightlyRates.map((rate, i) => ({
    Index: i,
    Amount: {
      Currency: pricingMeta.currency,
      // Gross-tax enterprises bill GrossValue; net-tax bill NetValue.
      ...(isNet ? { NetValue: rate } : { GrossValue: rate }),
      TaxCodes: pricingMeta.taxCodesByNight[i],
    },
  }));

  const resp = await mews<{
    Reservations?: Array<{
      Reservation?: { Id?: string; GroupId?: string; Number?: string };
    }>;
  }>("reservations/add", creds.accessToken, {
    ServiceId: creds.serviceId,
    CheckRateApplicability: false, // accept our Stripe-matching prices
    CheckOverbooking: true, // fail rather than oversell
    SendConfirmationEmail: false, // we send our own confirmation
    Reservations: [
      {
        Identifier: input.orderId, // correlation only, NOT idempotency
        State: "Confirmed",
        StartUtc: toMewsUtc(input.startDate, creds.timezone),
        EndUtc: toMewsUtc(input.endDate, creds.timezone),
        CustomerId: customerId,
        RequestedCategoryId: input.categoryId,
        RateId: input.rateId,
        PersonCounts: [{ AgeCategoryId: ageCategoryId, Count: input.adults }],
        TimeUnitPrices: timeUnitPrices,
        Notes: input.notes,
      },
    ],
  });

  const reservation = resp.Reservations?.[0]?.Reservation;
  if (!reservation?.Id) {
    throw new Error("Mews reservations/add returned no reservation Id");
  }
  return {
    pmsReservationId: reservation.Id,
    pmsGroupId: reservation.GroupId,
    customerId,
  };
}

// --- external payment ---------------------------------------------------

// Resolve the AccountId (= CustomerId) for a reservation. payments/addExternal
// needs it and our recordPayment params only carry the reservation id.
async function getReservationAccountId(
  creds: MewsCredentials,
  reservationId: string
): Promise<string> {
  const resp = await mews<{
    Reservations?: Array<{ CustomerId?: string; AccountId?: string }>;
  }>("reservations/getAll/2023-06-06", creds.accessToken, {
    ReservationIds: [reservationId],
    Limitation: { Count: 1 },
  });
  const r = resp.Reservations?.[0];
  const id = r?.AccountId ?? r?.CustomerId;
  if (!id) {
    throw new Error(
      `Mews: could not resolve AccountId for reservation ${reservationId}`
    );
  }
  return id;
}

export interface AddExternalPaymentInput {
  reservationId: string;
  amount: number;
  externalIdentifier?: string; // Stripe PaymentIntent id
  type?: string; // enabled external payment type
  notes?: string;
}

export async function addMewsExternalPayment(
  creds: MewsCredentials,
  input: AddExternalPaymentInput
): Promise<string> {
  const accountId = await getReservationAccountId(creds, input.reservationId);
  const isNet = creds.taxMode === "Net";
  const resp = await mews<{ ExternalPaymentId?: string; Payment?: { Id?: string } }>(
    "payments/addExternal",
    creds.accessToken,
    {
      AccountId: accountId,
      ReservationId: input.reservationId,
      Amount: {
        Currency: creds.currency,
        ...(isNet ? { NetValue: input.amount } : { GrossValue: input.amount }),
      },
      Type: input.type ?? creds.externalPaymentType ?? undefined,
      ExternalIdentifier: input.externalIdentifier,
      Notes: input.notes,
    }
  );
  const id = resp.ExternalPaymentId ?? resp.Payment?.Id;
  if (!id) throw new Error("Mews payments/addExternal returned no id");
  return id;
}

// --- cancel -------------------------------------------------------------

export async function cancelMewsReservation(
  creds: MewsCredentials,
  reservationId: string,
  reason?: string
): Promise<void> {
  // Dedicated cancel op — NOT reservations/update (its fee default is inverted).
  // Notes is required; PostCancellationFee defaults false (we refund in Stripe).
  await mews("reservations/cancel", creds.accessToken, {
    ReservationIds: [reservationId],
    Notes: reason ?? "Cancelled via booking engine",
    PostCancellationFee: false,
    SendEmail: false, // we own guest comms
  });
}

// --- extras + notes (deferred) ------------------------------------------
//
// Folio extras and staff notes are NOT yet wired for Mews. Mews models extras
// on a separate product/POS service (orders/add rejects the accommodation
// ServiceId), and the per-guest-per-night representation needs confirming with
// Mews (plan §7.2 / §13.5). The note-update shape likewise needs verifying.
// Both are non-fatal in the booking flow (try/catch, room booking still
// completes), so the adapter logs and no-ops until this is built — see
// MewsAdapter.postExtra / postReservationNote.
