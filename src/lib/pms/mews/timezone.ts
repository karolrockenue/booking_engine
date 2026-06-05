// Timezone conversion for Mews. Every `*Utc` field in the Connector API is UTC,
// but availability/pricing/reservations are reasoned about in the hotel's local
// calendar day. These helpers convert between the two using only `Intl` (no
// dependency) and avoid the classic BST/DST off-by-one — we never do
// `new Date(str).toISOString().slice(0,10)`, which silently shifts a day under
// summer time. Verified in src/scripts/mews-probe.ts.

// Offset (ms) of `timeZone` from UTC at a given instant: local wall-clock − UTC.
function tzOffsetMs(at: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(at)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second
  );
  return asUtc - at.getTime();
}

// Local calendar date ("YYYY-MM-DD") → ISO UTC instant of local midnight that
// day. e.g. toMewsUtc("2026-07-01", "Europe/London") -> "2026-06-30T23:00:00.000Z"
// (BST), toMewsUtc("2026-01-01", "Europe/London") -> "2026-01-01T00:00:00.000Z".
export function toMewsUtc(localDate: string, timeZone: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const guessUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guessUtc), timeZone);
  let result = guessUtc - offset;
  // Refine once: if the offset differs at the corrected instant (DST edge),
  // recompute using the offset that actually applies there.
  const offset2 = tzOffsetMs(new Date(result), timeZone);
  if (offset2 !== offset) result = guessUtc - offset2;
  return new Date(result).toISOString();
}

// UTC instant → local calendar date ("YYYY-MM-DD") in `timeZone`.
export function utcToLocalDate(utc: string | Date, timeZone: string): string {
  const d = typeof utc === "string" ? new Date(utc) : utc;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
