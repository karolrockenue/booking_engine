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
  };
  totalPrice: number;
  nightlyRates: NightlyRate[];
  nights: number;
}

export interface Extra {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  currency: string;
}

export interface BookingDraft {
  result: AvailabilityResult | null;
  extras: Set<string>; // extra IDs currently selected
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
