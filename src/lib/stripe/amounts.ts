// Stripe expects amounts in the smallest currency unit (e.g. pence for GBP,
// cents for USD/EUR). Most currencies are 2 decimals; a small set are 0 (JPY)
// or 3 (BHD/JOD). We only deal in 2-decimal currencies for now — extend the
// table when we onboard a hotel in a zero-decimal market.

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF",
  "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function toMinorUnits(amount: number, currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) return Math.round(amount);
  return Math.round(amount * 100);
}
