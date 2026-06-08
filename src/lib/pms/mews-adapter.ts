// Mews implementation of PmsAdapter. Read path is live (Phase 3); the write path
// and webhooks throw until Phase 4/5. Bound to one property; resolves its
// encrypted credentials lazily through getMewsCredentials.

import type {
  PmsAdapter,
  PmsProperty,
  PmsConnectionInfo,
  PmsSyncResult,
  CreateReservationParams,
  CreateReservationResult,
  PostExtraParams,
  PostExtraResult,
  ReverseExtraParams,
  RecordPaymentParams,
  RecordPaymentResult,
  RecordRefundParams,
  RecordRefundResult,
  CancelReservationParams,
  ReservationNoteParams,
  FindExistingReservationParams,
  FindExistingReservationResult,
} from "./types";
import type { AvailabilityResultRow } from "@/lib/booking/availability";
import { fetchMewsConnectionInfo } from "./mews/config";
import { getMewsCredentials } from "./mews/credentials";
import { syncMewsInventoryForProperty } from "./mews/sync-inventory";
import { syncMewsExtrasForProperty } from "./mews/sync-extras";
import { syncMewsHotelDetailsForProperty } from "./mews/sync-hotel-details";
import { computeMewsAvailability } from "./mews/availability";
import {
  createMewsReservation,
  addMewsExternalPayment,
  addMewsExternalRefund,
  addMewsProductOrder,
  reverseMewsExtra,
  cancelMewsReservation,
  findMewsReservation,
} from "./mews/reservations";

export class MewsAdapter implements PmsAdapter {
  readonly type = "mews" as const;

  constructor(private readonly property: PmsProperty) {}

  private get ourId(): string {
    return this.property.id;
  }

  async validateConnection(): Promise<PmsConnectionInfo> {
    const { accessToken } = await getMewsCredentials(this.ourId);
    const info = await fetchMewsConnectionInfo(accessToken);
    return {
      ok: true,
      enterpriseName: info.enterpriseName,
      currency: info.currency,
      timezone: info.timezone,
    };
  }

  async syncInventory(days?: number): Promise<PmsSyncResult> {
    return syncMewsInventoryForProperty(this.ourId, days);
  }

  async syncExtras(): Promise<void> {
    // Sync the admin-selected Orderable services' products into property_extras
    // (neutral shape). No-ops cleanly when no extras services are configured.
    await syncMewsExtrasForProperty(this.ourId);
  }

  async syncHotelDetails(): Promise<void> {
    await syncMewsHotelDetailsForProperty(this.ourId);
  }

  async getAvailability(
    checkIn: string,
    checkOut: string,
    adults: number
  ): Promise<AvailabilityResultRow[]> {
    return computeMewsAvailability(this.ourId, checkIn, checkOut, adults);
  }

  // --- write path (Phase 4) ---

  async createReservation(
    params: CreateReservationParams
  ): Promise<CreateReservationResult> {
    const creds = await getMewsCredentials(this.ourId);
    // Per-night prices are required so the Mews folio matches Stripe; without
    // them we cannot build TimeUnitPrices honestly.
    if (!params.nightlyRates || params.nightlyRates.length === 0) {
      throw new Error("Mews createReservation requires nightlyRates");
    }
    const { pmsReservationId, pmsGroupId } = await createMewsReservation(creds, {
      orderId: params.orderId,
      startDate: params.startDate,
      endDate: params.endDate,
      categoryId: params.roomTypeId,
      rateId: params.rateId,
      adults: params.adults,
      guest: {
        firstName: params.guestFirstName,
        lastName: params.guestLastName,
        email: params.guestEmail,
        phone: params.guestPhone,
        nationalityCode: params.guestCountry,
      },
      nightlyRates: params.nightlyRates.map((n) => n.rate),
    });
    return { pmsReservationId, pmsGroupId };
  }

  async findExistingReservation(
    params: FindExistingReservationParams
  ): Promise<FindExistingReservationResult | null> {
    const creds = await getMewsCredentials(this.ourId);
    const id = await findMewsReservation(creds, {
      startDate: params.startDate,
      endDate: params.endDate,
      categoryId: params.roomTypeId,
      customerEmail: params.guestEmail,
    });
    return id ? { pmsReservationId: id } : null;
  }

  async recordPayment(
    params: RecordPaymentParams
  ): Promise<RecordPaymentResult> {
    const creds = await getMewsCredentials(this.ourId);
    const pmsPaymentId = await addMewsExternalPayment(creds, {
      reservationId: params.reservationId,
      amount: params.amount,
      externalIdentifier: params.externalIdentifier,
      notes: params.description,
    });
    return { pmsPaymentId };
  }

  // §7.4: cancelling a reservation zeroes the room but leaves the recorded
  // external payment on the folio, so it still reads as paid. After Stripe
  // refunds, post a compensating negative external payment so the folio nets to
  // zero. `params.amount` is the positive refunded amount.
  async recordRefund(
    params: RecordRefundParams
  ): Promise<RecordRefundResult | null> {
    const creds = await getMewsCredentials(this.ourId);
    const pmsRefundId = await addMewsExternalRefund(creds, {
      reservationId: params.reservationId,
      amount: params.amount,
      type: params.type,
      externalIdentifier: params.externalIdentifier,
      notes: params.description,
    });
    return { pmsRefundId };
  }

  async cancelReservation(params: CancelReservationParams): Promise<void> {
    const creds = await getMewsCredentials(this.ourId);
    await cancelMewsReservation(creds, params.reservationId, params.reason);
  }

  // Post an extra as a Mews ProductOrder on the product's own Orderable service
  // (orders/add rejects the accommodation service). Needs the product id + its
  // service id, threaded from property_extras by the booking route; without them
  // (e.g. a stale/un-synced extra) we log and skip rather than fail the booking.
  // The returned pmsItemId is the Mews OrderId — stored so cancel can reverse it.
  async postExtra(params: PostExtraParams): Promise<PostExtraResult> {
    if (!params.otaExtraId || !params.pmsServiceId) {
      console.warn(
        `[Mews] postExtra: missing product/service id for "${params.name}" — not posted for reservation ${params.reservationId}`
      );
      return { pmsItemId: "" };
    }
    const creds = await getMewsCredentials(this.ourId);
    const orderId = await addMewsProductOrder(creds, {
      reservationId: params.reservationId,
      productId: params.otaExtraId,
      serviceId: params.pmsServiceId,
      count: params.quantity,
    });
    return { pmsItemId: orderId };
  }

  async reverseExtra(params: ReverseExtraParams): Promise<void> {
    if (!params.pmsItemId) return;
    const creds = await getMewsCredentials(this.ourId);
    // pmsItemId is one or more OrderIds (per-morning posts are comma-joined).
    await reverseMewsExtra(creds, params.pmsItemId.split(",").filter(Boolean));
  }

  // Mews Connector has NO post-creation note operation — `Notes` exists only on
  // reservations/add (verified against the docs), and the booking flow posts its
  // note (the extras breakdown) AFTER creating the reservation + extras. So there
  // is nowhere to put it on Mews; instead the breakdown is visible on the folio
  // as the named ProductOrder lines (one per morning for per-night extras). This
  // is a documented no-op, not a stub. (Folding the summary into the creation
  // Notes would mean reordering the certified shared booking path — deferred.)
  async postReservationNote(
    params: ReservationNoteParams
  ): Promise<{ noteId: string }> {
    console.log(
      `[Mews] postReservationNote is a no-op (Connector has no post-create note op) — extras show as folio lines for reservation ${params.reservationId}`
    );
    return { noteId: "" };
  }

  // --- webhooks (Phase 5) ---
  //
  // Unlike Cloudbeds (per-property postWebhook subscriptions), Mews General
  // Webhooks are configured once at the INTEGRATION level — a single endpoint
  // for the whole ClientToken, set in the Mews integration configuration (and
  // finalised with Mews at certification, P6), not via a per-property Connector
  // call. So there is nothing to subscribe/unsubscribe per property; these are
  // intentional no-ops that satisfy the PmsAdapter contract. Inbound events are
  // handled at /api/mews/webhooks/[token] → handleMewsWebhookEvents.
  async subscribeWebhooks(): Promise<void> {
    console.log(
      `[Mews] subscribeWebhooks is a no-op for ${this.ourId} — General Webhooks are integration-level, not per-property`
    );
  }
  async unsubscribeWebhooks(): Promise<void> {
    console.log(
      `[Mews] unsubscribeWebhooks is a no-op for ${this.ourId} — General Webhooks are integration-level, not per-property`
    );
  }
}
