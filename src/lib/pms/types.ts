// Provider-neutral PMS adapter contract.
//
// The booking engine talks to every PMS (Cloudbeds today, Mews next) through
// this single interface. An adapter is bound to one property; method params use
// our own/neutral identifiers and the adapter maps them to the PMS's native
// shapes. See `Mews Integration — Plan for Review.md` for the design rationale.

import type { AvailabilityResultRow } from "@/lib/booking/availability";

export type PmsType = "cloudbeds" | "mews";

// The minimal property shape an adapter needs. The full Drizzle `properties`
// row satisfies this structurally, so call sites can pass it directly.
export interface PmsProperty {
  id: string;
  cloudbedsPropertyId: string | null;
  // The DB column is free `text` (default "cloudbeds"); the factory narrows it.
  pmsType?: string | null;
}

// --- write path ---------------------------------------------------------

export interface CreateReservationParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestCountry?: string;
  guestPhone?: string;
  roomTypeId: string; // PMS-native room id (room_types.ota_room_id)
  rateId: string; // PMS-native rate id (rate_plans.ota_rate_id)
  adults: number;
  children: number;
  roomSubtotal: number; // major units, room only (extras posted separately)
  orderId: string; // our order id, passed to the PMS as its third-party id
  paymentMethod?: string;
  // Exact per-night room prices charged via Stripe, in stay order. Cloudbeds
  // ignores this (it prices the room itself); Mews requires it to build
  // TimeUnitPrices so the PMS folio matches Stripe to the cent.
  nightlyRates?: Array<{ date: string; rate: number }>;
}
export interface CreateReservationResult {
  pmsReservationId: string;
  pmsGroupId?: string;
}

export interface PostExtraParams {
  reservationId: string; // PMS-native reservation id
  name: string;
  amount: number; // major units, unit price
  quantity: number;
  serviceDate?: string; // YYYY-MM-DD, for per-day folio dating
}
export interface PostExtraResult {
  pmsItemId: string;
}

export interface RecordPaymentParams {
  reservationId: string;
  amount: number; // major units
  type?: string;
  description?: string; // e.g. "Stripe pi_..." for reconciliation
  // Stripe PaymentIntent id. Cloudbeds folds it into the description; Mews uses
  // it as the external payment's ExternalIdentifier for reconciliation.
  externalIdentifier?: string;
}
export interface RecordPaymentResult {
  pmsPaymentId: string;
}

export interface CancelReservationParams {
  reservationId: string;
  reason?: string;
}

export interface ReservationNoteParams {
  reservationId: string;
  note: string;
}

// --- read / sync --------------------------------------------------------

export interface PmsConnectionInfo {
  ok: boolean;
  enterpriseName?: string;
  currency?: string;
  timezone?: string;
}

// Neutral summary of an inventory sync. Mirrors the Cloudbeds SyncResult so the
// existing admin sync response is unchanged; Mews populates the same fields.
export interface PmsSyncResult {
  propertyId: string;
  cloudbedsPropertyId?: string;
  roomTypesUpserted: number;
  ratePlansUpserted: number;
  inventoryRowsUpserted: number;
  extrasUpserted: number;
  extrasDeleted: number;
  hotelDetailsContactUpdated: boolean;
  hotelDetailsNeighbourhoodUpdated: boolean;
  hotelDetailsGoodToKnowUpdated: boolean;
  hotelDetailsPropertyFieldsUpdated: string[];
  rangeStart: string;
  rangeEnd: string;
  durationMs: number;
}

// --- the contract -------------------------------------------------------

export interface PmsAdapter {
  readonly type: PmsType;

  // connection
  validateConnection(): Promise<PmsConnectionInfo>;

  // read / sync into our DB
  syncInventory(days?: number): Promise<PmsSyncResult>;
  syncExtras(): Promise<void>;
  syncHotelDetails(): Promise<void>;
  getAvailability(
    checkIn: string,
    checkOut: string,
    adults: number
  ): Promise<AvailabilityResultRow[]>;

  // write
  createReservation(
    params: CreateReservationParams
  ): Promise<CreateReservationResult>;
  postExtra(params: PostExtraParams): Promise<PostExtraResult>;
  recordPayment(params: RecordPaymentParams): Promise<RecordPaymentResult>;
  cancelReservation(params: CancelReservationParams): Promise<void>;
  postReservationNote(params: ReservationNoteParams): Promise<{ noteId: string }>;

  // webhooks
  subscribeWebhooks(): Promise<void>;
  unsubscribeWebhooks(): Promise<void>;
}
