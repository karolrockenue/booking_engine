// Canonical types for the booking flow. Per-hotel components import these
// instead of redefining their own — keeps the API contract enforceable.

export interface NightlyRate {
  date: string; // YYYY-MM-DD
  rate: number;
}

export interface AvailabilityResult {
  roomType: {
    id: string;
    otaRoomId?: string;
    name: string;
    description?: string | null;
    maxOccupancy?: number | null;
    amenities?: unknown;
  };
  ratePlan: {
    id: string;
    otaRateId?: string;
    name: string;
    isRefundable: boolean;
  };
  totalPrice: number;
  nightlyRates: NightlyRate[];
  nights: number;
}

// How an extra is charged. See lib/booking/extra-pricing.ts.
export type PricingModel = "per_stay" | "per_guest_per_night";

export interface Extra {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
  pricingModel: PricingModel;
}

// Guest-chosen options for a `per_guest_per_night` extra (e.g. breakfast):
// how many of the party want it, and on which mornings. Absent = the default
// (everyone, every morning). `mornings` are YYYY-MM-DD dates (the morning after
// each night — see stayMornings()).
export interface ExtraConfig {
  guests: number;
  mornings: string[];
}

export interface BookingDraft {
  result: AvailabilityResult | null;
  extras: Set<string>; // extra IDs currently selected
  // Per-extra options for per_guest_per_night extras. Keyed by extra ID; only
  // present for extras the guest has customised (others use the default).
  extrasConfig: Record<string, ExtraConfig>;
}

// Persisted form (sets aren't JSON-serialisable). Used by usePersistedDraft.
export interface PersistedBookingDraft {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  result: AvailabilityResult | null;
  extras: string[];
  extrasConfig?: Record<string, ExtraConfig>;
  specialRequests?: string;
  savedAt: number; // epoch ms; for TTL
}

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  specialRequests?: string;
}
