import type { Extra, PricingModel } from "./types";

// How an extra is charged. Cloudbeds doesn't expose this on the addon/item
// API (verified 2026-05-20), so it's our own per-extra config:
//   per_stay            -> charged once per booking (Early Check-In, Late
//                          Check-Out, parking, …)
//   per_guest_per_night -> one unit per guest per night (Breakfast: a breakfast
//                          for every guest, every morning after a night —
//                          so guests x nights)
export const PRICING_MODELS: PricingModel[] = ["per_stay", "per_guest_per_night"];

export function isPricingModel(v: unknown): v is PricingModel {
  return v === "per_stay" || v === "per_guest_per_night";
}

// Units charged for one extra on a given stay. `guests` is the full headcount
// (adults + children). Floors of 1 guard against a malformed 0-night/0-guest
// input ever zeroing out a charge.
export function extraQuantity(
  model: PricingModel,
  nights: number,
  guests: number
): number {
  if (model === "per_guest_per_night") {
    return Math.max(1, nights) * Math.max(1, guests);
  }
  return 1;
}

// Major-units line total for one extra (unit price x quantity).
export function extraLineTotal(
  unitMajor: number,
  model: PricingModel,
  nights: number,
  guests: number
): number {
  return unitMajor * extraQuantity(model, nights, guests);
}

// Sum (major units) of the selected extras, each priced by its own model.
// The single source of truth for the extras subtotal — used by the client
// (display + the amount sent to Stripe) AND the server (booking record +
// Cloudbeds folio), so the charge, the booking, and the PMS always agree.
export function extrasSubtotal(
  extras: Pick<Extra, "id" | "priceMinorUnits" | "pricingModel">[],
  selectedIds: Iterable<string>,
  nights: number,
  guests: number
): number {
  const set = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  let total = 0;
  for (const e of extras) {
    if (!set.has(e.id)) continue;
    total += extraLineTotal(e.priceMinorUnits / 100, e.pricingModel, nights, guests);
  }
  return total;
}
