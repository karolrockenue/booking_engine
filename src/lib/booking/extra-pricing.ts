import type { Extra, ExtraConfig, PricingModel } from "./types";

// How an extra is charged. Cloudbeds doesn't expose this on the addon/item
// API (verified 2026-05-20), so it's our own per-extra config:
//   per_stay            -> charged once per booking (Early Check-In, Late
//                          Check-Out, parking, …)
//   per_guest_per_night -> one unit per guest per night, by default. The guest
//                          can narrow it to fewer people / specific mornings
//                          via an ExtraConfig (breakfast picker).
export const PRICING_MODELS: PricingModel[] = ["per_stay", "per_guest_per_night"];

export function isPricingModel(v: unknown): v is PricingModel {
  return v === "per_stay" || v === "per_guest_per_night";
}

// The mornings of a stay: breakfast is served the morning AFTER each night, so
// for a stay starting `checkIn` with N nights the mornings are checkIn+1 …
// checkIn+N (the last being checkout morning). Returns YYYY-MM-DD dates.
export function stayMornings(checkIn: string, nights: number): string[] {
  const out: string[] = [];
  const start = new Date(`${checkIn}T00:00:00Z`);
  for (let i = 1; i <= Math.max(0, Math.floor(nights)); i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

// Units charged for one extra on a given stay.
//   per_stay            -> 1
//   per_guest_per_night -> config ? config.guests * config.mornings.length
//                                 : guests * nights   (the default)
// `guests` is the full headcount (adults + children). The config wins when the
// guest has customised it (fewer people / specific mornings).
export function extraQuantity(
  model: PricingModel,
  nights: number,
  guests: number,
  config?: ExtraConfig | null
): number {
  if (model !== "per_guest_per_night") return 1;
  if (config) {
    return Math.max(0, Math.floor(config.guests)) * config.mornings.length;
  }
  return Math.max(1, nights) * Math.max(1, guests);
}

// Major-units line total for one extra (unit price x quantity).
export function extraLineTotal(
  unitMajor: number,
  model: PricingModel,
  nights: number,
  guests: number,
  config?: ExtraConfig | null
): number {
  return unitMajor * extraQuantity(model, nights, guests, config);
}

// Sum (major units) of the selected extras, each priced by its own model and
// optional per-extra config. The single source of truth for the extras
// subtotal — used by the client (display + the amount sent to Stripe) AND the
// server (booking record + Cloudbeds folio), so charge, booking, and PMS agree.
export function extrasSubtotal(
  extras: Pick<Extra, "id" | "priceMinorUnits" | "pricingModel">[],
  selectedIds: Iterable<string>,
  nights: number,
  guests: number,
  configs?: Record<string, ExtraConfig> | null
): number {
  const set = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  let total = 0;
  for (const e of extras) {
    if (!set.has(e.id)) continue;
    total += extraLineTotal(
      e.priceMinorUnits / 100,
      e.pricingModel,
      nights,
      guests,
      configs?.[e.id]
    );
  }
  return total;
}
