// Map rate plan names → supporting text shown under the rate name on the
// room-select page. Cloudbeds rate-plan names are operator-controlled (e.g.
// "Direct Non-refundable", "BAR with Breakfast", "Advance Purchase 14"), so
// the policy / what's-included is encoded in the name. We pattern-match
// against the name and surface the matching note. Falls back to a
// refundable/non-refundable default.
//
// To add a new mapping: append to PATTERNS below. Order matters — first
// match wins, so put the more specific patterns first.

interface Pattern {
  test: RegExp;
  note: string;
}

const PATTERNS: Pattern[] = [
  // Specific bundles / inclusions first
  {
    test: /breakfast/i,
    note: "Continental tray for two. Cancel free up to 48 hours before arrival.",
  },
  {
    test: /(member|loyalty|portico\s*saver)/i,
    note: "Members rate — direct only. Charged today, no refunds.",
  },
  {
    test: /(early\s*bird|advance|advanced\s*purchase)/i,
    note: "Advance purchase — charged today. No changes, no refunds.",
  },

  // Policy-driven (broader)
  {
    test: /non[-\s]?refund/i,
    note: "Charged today. No changes, no refunds.",
  },
  {
    test: /(flexible|free\s*cancel|refundable|best\s*available)/i,
    note: "Cancel free of charge up to 48 hours before arrival.",
  },
];

/**
 * Returns the supporting text shown under a rate plan's name. Tries to match
 * the rate plan name against a list of known patterns; falls back to a
 * refundable / non-refundable default based on the rate plan flag.
 */
export function supportingNoteFor(name: string, isRefundable: boolean): string {
  for (const p of PATTERNS) {
    if (p.test.test(name)) return p.note;
  }
  return isRefundable
    ? "Cancel free of charge up to 48 hours before arrival."
    : "Charged today. No changes, no refunds.";
}
