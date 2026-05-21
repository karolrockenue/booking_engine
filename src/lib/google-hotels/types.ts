// Types for the Google Hotel Center integration. See
// "Google Hotel Center — Blueprint.md" in the repo root for the full work
// stream; this file backs Sprint 1 (the Hotel List XML feed).

// Shape of the `contact` content block (synced from Cloudbeds hotel-details).
export interface ContactBlock {
  addressLines?: string[];
  reservationsPhone?: string;
}

// Shape of the `neighbourhood` content block.
export interface NeighbourhoodBlock {
  mapLat?: number;
  mapLon?: number;
}

// Address parsed out of the free-text `addressLines` into the structured
// components Google's `format="simple"` address wants.
export interface ParsedAddress {
  addr1?: string;
  city?: string;
  postal?: string;
  country: string; // ISO 3166-1 alpha-2, uppercase
}

export interface HotelListFeedResult {
  xml: string;
  total: number; // properties considered
  included: number; // listings actually emitted
  withWebsite: number; // listings that carry a <website> (have a domain)
  warnings: string[]; // per-property data gaps worth surfacing
}
