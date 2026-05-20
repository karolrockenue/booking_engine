// Cloudbeds OAuth scopes requested by this integration.
//
// **Adding any new scope requires re-OAuth on every connected property** —
// old tokens don't carry it.
export const SCOPES = [
  "read:addon",
  "read:currency",
  "read:guest",
  "write:guest",
  "read:hotel",
  // Folio line items — postCustomItem attaches paid extras to a reservation.
  // Granted in the Cloudbeds console 2026-05-20 (Item → Read/Write/Delete);
  // we request read+write only, never delete a folio item.
  "read:item",
  "write:item",
  // Folio payments — postPayment records the Stripe charge against the
  // reservation (NR rates). Granted 2026-05-20 (Payment → Read/Write).
  "read:payment",
  "write:payment",
  "read:rate",
  "read:reservation",
  "write:reservation",
  "read:room",
  "read:taxesAndFees",
  "read:user",
] as const;

export const SCOPES_STRING = SCOPES.join(" ");
