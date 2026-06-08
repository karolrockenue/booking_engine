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
  RecordPaymentParams,
  RecordPaymentResult,
  CancelReservationParams,
  ReservationNoteParams,
  FindExistingReservationParams,
  FindExistingReservationResult,
} from "./types";
import type { AvailabilityResultRow } from "@/lib/booking/availability";
import { fetchMewsConnectionInfo } from "./mews/config";
import { getMewsCredentials } from "./mews/credentials";
import { syncMewsInventoryForProperty } from "./mews/sync-inventory";
import { syncMewsHotelDetailsForProperty } from "./mews/sync-hotel-details";
import { computeMewsAvailability } from "./mews/availability";
import {
  createMewsReservation,
  addMewsExternalPayment,
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
    // Extras land with the Phase 4 write path: the property_extras table is
    // Cloudbeds-shaped (cloudbeds_addon_id NOT NULL), so a neutral extras model
    // is built alongside Mews ProductOrders. No-op here so syncInventory's
    // extras step (and any caller) is safe against a Mews property.
    console.log(`[Mews] syncExtras skipped for ${this.ourId} (Phase 4)`);
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

  async cancelReservation(params: CancelReservationParams): Promise<void> {
    const creds = await getMewsCredentials(this.ourId);
    await cancelMewsReservation(creds, params.reservationId, params.reason);
  }

  // Folio extras + staff notes are deferred (see mews/reservations.ts): Mews
  // posts extras on a separate product service and the per-night representation
  // needs confirming with Mews. Both are non-fatal in the booking flow, so we
  // log and no-op rather than throw — a room booking still completes; the extra
  // just isn't mirrored to the Mews folio yet.
  async postExtra(params: PostExtraParams): Promise<PostExtraResult> {
    console.warn(
      `[Mews] postExtra not yet implemented — "${params.name}" x${params.quantity} not posted to folio for reservation ${params.reservationId}`
    );
    return { pmsItemId: "" };
  }

  async postReservationNote(
    params: ReservationNoteParams
  ): Promise<{ noteId: string }> {
    console.warn(
      `[Mews] postReservationNote not yet implemented — note not posted for reservation ${params.reservationId}`
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
