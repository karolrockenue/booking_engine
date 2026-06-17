// Client-safe legal constants — no server imports (db/marked/dompurify live in
// lib/legal.ts). Safe to import from "use client" components.

export const LEGAL_SLUGS = [
  "privacy",
  "cookies",
  "accessibility",
  "terms",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_LABELS: Record<LegalSlug, string> = {
  privacy: "Privacy policy",
  cookies: "Cookie policy",
  accessibility: "Accessibility",
  terms: "Terms & conditions",
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}
