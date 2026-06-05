// Cloudbeds implementation of PmsAdapter. This is a thin delegation layer over
// the existing `src/lib/cloudbeds/*` functions — no Cloudbeds logic lives here,
// so behaviour is identical to calling those functions directly. The adapter is
// bound to one property and injects its ids/credentials into each call.

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
import { computeAvailability } from "@/lib/booking/availability";
import { getValidAccessToken } from "@/lib/cloudbeds/client";
import {
  postReservation,
  postCustomItem,
  postPayment,
  putReservationStatus,
  postReservationNote,
} from "@/lib/cloudbeds/reservations";
import { syncInventoryForProperty } from "@/lib/cloudbeds/sync-inventory";
import { syncExtrasForProperty } from "@/lib/cloudbeds/sync-extras";
import { syncHotelDetailsForProperty } from "@/lib/cloudbeds/sync-hotel-details";
import {
  subscribeWebhooksForProperty,
  unsubscribeWebhooksForProperty,
} from "@/lib/cloudbeds/webhook-subscriptions";

export class CloudbedsAdapter implements PmsAdapter {
  readonly type = "cloudbeds" as const;

  constructor(private readonly property: PmsProperty) {}

  private get ourId(): string {
    return this.property.id;
  }

  // Writes require a connected Cloudbeds property. In practice every property
  // reaching the write path is connected; this guards the type + a misuse.
  private cbId(): string {
    const id = this.property.cloudbedsPropertyId;
    if (!id) {
      throw new Error(
        `Property ${this.property.id} is not connected to Cloudbeds`
      );
    }
    return id;
  }

  async validateConnection(): Promise<PmsConnectionInfo> {
    // getValidAccessToken refreshes/throws; reaching here means the token works.
    await getValidAccessToken(this.ourId);
    return { ok: true };
  }

  async syncInventory(days?: number): Promise<PmsSyncResult> {
    return syncInventoryForProperty(this.ourId, days);
  }

  async syncExtras(): Promise<void> {
    await syncExtrasForProperty(this.ourId);
  }

  async syncHotelDetails(): Promise<void> {
    await syncHotelDetailsForProperty(this.ourId);
  }

  async getAvailability(
    checkIn: string,
    checkOut: string,
    adults: number
  ): Promise<AvailabilityResultRow[]> {
    return computeAvailability(this.ourId, checkIn, checkOut, adults);
  }

  async createReservation(
    params: CreateReservationParams
  ): Promise<CreateReservationResult> {
    const { reservationID } = await postReservation(this.ourId, {
      cloudbedsPropertyId: this.cbId(),
      startDate: params.startDate,
      endDate: params.endDate,
      guestFirstName: params.guestFirstName,
      guestLastName: params.guestLastName,
      guestEmail: params.guestEmail,
      guestCountry: params.guestCountry,
      guestPhone: params.guestPhone,
      roomTypeID: params.roomTypeId,
      ratesID: params.rateId,
      adults: params.adults,
      children: params.children,
      subtotal: params.roomSubtotal,
      thirdPartyIdentifier: params.orderId,
      paymentMethod: params.paymentMethod,
    });
    return { pmsReservationId: reservationID };
  }

  async postExtra(params: PostExtraParams): Promise<PostExtraResult> {
    const { itemID } = await postCustomItem(this.ourId, {
      cloudbedsPropertyId: this.cbId(),
      reservationID: params.reservationId,
      name: params.name,
      amount: params.amount,
      quantity: params.quantity,
      serviceDate: params.serviceDate,
    });
    return { pmsItemId: itemID };
  }

  async recordPayment(
    params: RecordPaymentParams
  ): Promise<RecordPaymentResult> {
    const { paymentID } = await postPayment(this.ourId, {
      cloudbedsPropertyId: this.cbId(),
      reservationID: params.reservationId,
      amount: params.amount,
      type: params.type,
      description: params.description,
    });
    return { pmsPaymentId: paymentID };
  }

  async cancelReservation(params: CancelReservationParams): Promise<void> {
    await putReservationStatus(this.ourId, {
      cloudbedsPropertyId: this.cbId(),
      reservationID: params.reservationId,
      status: "canceled",
      reason: params.reason,
    });
  }

  async postReservationNote(
    params: ReservationNoteParams
  ): Promise<{ noteId: string }> {
    const { noteID } = await postReservationNote(this.ourId, {
      cloudbedsPropertyId: this.cbId(),
      reservationID: params.reservationId,
      note: params.note,
    });
    return { noteId: noteID };
  }

  async subscribeWebhooks(): Promise<void> {
    await subscribeWebhooksForProperty(this.ourId);
  }

  async unsubscribeWebhooks(): Promise<void> {
    await unsubscribeWebhooksForProperty(this.ourId);
  }
}
