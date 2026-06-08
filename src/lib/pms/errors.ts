// Provider-neutral PMS errors the booking flow maps to specific UX.

import { MewsApiError } from "./mews/client";

// The requested room/category just sold out — the PMS refused to create the
// reservation because there's no availability (anti-oversell). Distinct from a
// transient sync failure: retrying won't help, so the storefront should tell the
// guest to pick another room rather than show a generic error.
export class PmsSoldOutError extends Error {
  constructor(message = "This room just sold out for the selected dates.") {
    super(message);
    this.name = "PmsSoldOutError";
  }
}

// Mews signals oversell on reservations/add as HTTP 403 with an availability
// message, e.g. "We're very sorry, this property has no availability for the
// selected dates." (Details: null) — captured on demo via
// scripts/mews-soldout-probe.ts. Match on the message so we don't confuse it
// with the other 403 (the "conflicting operation" write-serialisation case,
// which the client retries internally and never surfaces here).
export function isMewsSoldOut(e: unknown): e is MewsApiError {
  return (
    e instanceof MewsApiError &&
    e.status === 403 &&
    /no availability|overbook|sold\s?out/i.test(e.message)
  );
}
