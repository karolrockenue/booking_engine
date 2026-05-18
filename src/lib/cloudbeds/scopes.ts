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
  "read:rate",
  "read:reservation",
  "write:reservation",
  "read:room",
  "read:taxesAndFees",
  "read:user",
] as const;

export const SCOPES_STRING = SCOPES.join(" ");
