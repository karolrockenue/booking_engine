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
  serviceDate?: string; // YYYY-MM-DD, for per-day folio dating (Cloudbeds)
  // Mews only: the product to order + its Orderable service. Cloudbeds ignores
  // both (it posts a free custom item by name/amount). When present, Mews posts
  // a ProductOrder; the returned pmsItemId is the Mews OrderId.
  otaExtraId?: string; // Mews ProductId (property_extras.ota_extra_id)
  pmsServiceId?: string; // Mews Orderable ServiceId (property_extras.pms_service_id)
}
export interface PostExtraResult {
  pmsItemId: string; // Cloudbeds folio item id, or Mews OrderId
}

// Reverse a previously posted extra when a booking is cancelled. Cloudbeds posts
// an offsetting negative custom item; Mews cancels the order's items
// (orderItems/cancel). `pmsItemId` is whatever postExtra returned.
export interface ReverseExtraParams {
  reservationId: string;
  pmsItemId: string; // Cloudbeds folio item id(s), or Mews OrderId
  name: string;
  unitPrice: number; // major units (Cloudbeds posts -unitPrice × qty)
  quantity: number;
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

// Record a refund that already happened in Stripe back onto the PMS folio.
// Cancelling a reservation zeroes the room but leaves the previously recorded
// external payment on the folio, so it still reads as paid; this posts the
// compensating reversal so the folio reconciles (plan §7.4).
export interface RecordRefundParams {
  reservationId: string;
  amount: number; // major units, POSITIVE — the amount refunded in Stripe
  type?: string;
  description?: string; // e.g. "Stripe refund re_..." for reconciliation
  externalIdentifier?: string; // Stripe refund id
}
export interface RecordRefundResult {
  pmsRefundId: string;
}

// Used by the write-recovery cron to avoid creating a duplicate reservation when
// a prior attempt may have already succeeded in the PMS but we never stored the
// id (lost response / crash mid-flight). The adapter looks for an existing
// reservation matching this booking and returns it if found.
export interface FindExistingReservationParams {
  orderId: string; // our order id (Cloudbeds dedupes on it; Mews cannot — see below)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  roomTypeId: string; // PMS-native room/category id (room_types.ota_room_id)
  guestEmail?: string; // resolves the PMS customer for a precise match (Mews)
}
export interface FindExistingReservationResult {
  pmsReservationId: string;
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
  // Anti-duplicate lookup for retry recovery. Returns an existing reservation
  // matching this booking, or null if none is found (the caller then creates).
  findExistingReservation(
    params: FindExistingReservationParams
  ): Promise<FindExistingReservationResult | null>;
  postExtra(params: PostExtraParams): Promise<PostExtraResult>;
  // Reverse a posted extra on cancellation (offsetting line / order cancel).
  reverseExtra(params: ReverseExtraParams): Promise<void>;
  recordPayment(params: RecordPaymentParams): Promise<RecordPaymentResult>;
  // Post a compensating reversal for a Stripe refund. Returns null when the PMS
  // doesn't reconcile refunds via the adapter (Cloudbeds today — see §7.4).
  recordRefund(
    params: RecordRefundParams
  ): Promise<RecordRefundResult | null>;
  cancelReservation(params: CancelReservationParams): Promise<void>;
  postReservationNote(params: ReservationNoteParams): Promise<{ noteId: string }>;

  // webhooks
  subscribeWebhooks(): Promise<void>;
  unsubscribeWebhooks(): Promise<void>;
}
