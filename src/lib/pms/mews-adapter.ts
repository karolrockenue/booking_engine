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
} from "./types";
import type { AvailabilityResultRow } from "@/lib/booking/availability";
import { fetchMewsConnectionInfo } from "./mews/config";
import { getMewsCredentials } from "./mews/credentials";
import { syncMewsInventoryForProperty } from "./mews/sync-inventory";
import { syncMewsHotelDetailsForProperty } from "./mews/sync-hotel-details";
import { computeMewsAvailability } from "./mews/availability";

const NOT_YET = (op: string) =>
  new Error(`Mews ${op} is not implemented yet (Phase 4/5)`);

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
    _params: CreateReservationParams
  ): Promise<CreateReservationResult> {
    throw NOT_YET("createReservation");
  }
  async postExtra(_params: PostExtraParams): Promise<PostExtraResult> {
    throw NOT_YET("postExtra");
  }
  async recordPayment(
    _params: RecordPaymentParams
  ): Promise<RecordPaymentResult> {
    throw NOT_YET("recordPayment");
  }
  async cancelReservation(_params: CancelReservationParams): Promise<void> {
    throw NOT_YET("cancelReservation");
  }
  async postReservationNote(
    _params: ReservationNoteParams
  ): Promise<{ noteId: string }> {
    throw NOT_YET("postReservationNote");
  }

  // --- webhooks (Phase 5) ---

  async subscribeWebhooks(): Promise<void> {
    throw NOT_YET("subscribeWebhooks");
  }
  async unsubscribeWebhooks(): Promise<void> {
    throw NOT_YET("unsubscribeWebhooks");
  }
}
