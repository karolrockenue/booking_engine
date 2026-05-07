// Content schema for property-editable copy. Each block lives as a row in the
// `content_blocks` table keyed by `key` (e.g. "hero", "neighbourhood").
// Admin saves each block independently via POST /api/admin/properties/[id]/content.
// Customer-facing screens read all blocks via getPropertyContent() with these
// defaults filling in for missing keys — so a fresh property still renders.
//
// Inline emphasis: any `*word*` in text fields renders as italic-accent on
// customer pages. See `renderEmphasis` in src/themes/portico/components/emphasis.tsx.

export interface ContentHero {
  eyebrow: string;
  headline: string; // \n separates lines; *…* = italic accent
  pressQuote: string;
  pressQuoteAttribution: string;
  bookCtaLabel: string;
}

export interface ContentNeighbourhood {
  eyebrow: string;
  title: string; // *…* = italic accent
  body: string;
  nearby: Array<{ place: string; dist: string }>;
  mapLat: number;
  mapLon: number;
}

export interface ContentGoodToKnow {
  eyebrow: string;
  title: string; // *…* = italic accent
  rows: Array<{ label: string; value: string }>;
}

export interface ContentContact {
  addressLines: string[]; // displayed one per line in the footer Visit column
  receptionLine: string;
  reservationsPhone: string;
  reservationsEmail: string;
  generalEmail: string;
}

export interface ContentFooter {
  brandTagline: string;
  fineprintLinks: Array<{ label: string; href: string }>;
}

export interface PropertyContent {
  hero: ContentHero;
  neighbourhood: ContentNeighbourhood;
  goodToKnow: ContentGoodToKnow;
  contact: ContentContact;
  footer: ContentFooter;
}

export const CONTENT_KEYS = [
  "hero",
  "neighbourhood",
  "goodToKnow",
  "contact",
  "footer",
] as const;

export type ContentKey = (typeof CONTENT_KEYS)[number];

// Defaults are taken from Portico's existing hardcoded copy so the site looks
// identical when the DB is empty. They double as seed copy for new hotels.
export const defaultContent: PropertyContent = {
  hero: {
    eyebrow: "Paddington · London · W2",
    headline: "An evening\nat *The Portico*,\nany night you choose.",
    pressQuote: "A jewel-box behind a Paddington portico.",
    pressQuoteAttribution: "Conde Nast Traveller",
    bookCtaLabel: "Book a room →",
  },
  neighbourhood: {
    eyebrow: "01 — Neighbourhood",
    title: "Behind a Paddington portico,\na *quiet* Edwardian street.",
    body:
      "Sussex Gardens is the kind of London street that hasn't quite been discovered. Two minutes from Hyde Park's Italian Gardens. Eight from Marylebone Village. Paddington Station — direct to Heathrow in fifteen — is around the corner.",
    nearby: [
      { place: "Hyde Park", dist: "2 min walk" },
      { place: "Paddington Station", dist: "4 min walk" },
      { place: "Marylebone Village", dist: "8 min walk" },
      { place: "Notting Hill", dist: "12 min walk" },
      { place: "Oxford Street", dist: "12 min by Tube" },
      { place: "Heathrow Airport", dist: "15 min by Heathrow Express" },
    ],
    mapLat: 51.5158,
    mapLon: -0.1745,
  },
  goodToKnow: {
    eyebrow: "03 — Good to know",
    title: "The *practicalities*.",
    rows: [
      { label: "Check-in", value: "From 4pm" },
      { label: "Check-out", value: "By 11am" },
      { label: "Reception", value: "24 hours" },
      { label: "Wi-Fi", value: "Complimentary throughout" },
      { label: "Parking", value: "NCP, 3 min walk" },
      { label: "Children", value: "Welcome · cot on request" },
      { label: "Pets", value: "Small dogs by arrangement" },
      { label: "Accessibility", value: "Lift to all floors · 1 ADA room" },
    ],
  },
  contact: {
    addressLines: ["32 Sussex Gardens", "Paddington", "London W2 1UJ"],
    receptionLine: "Reception · 24 hours",
    reservationsPhone: "+44 20 7402 0190",
    reservationsEmail: "stay@theporticohotel.com",
    generalEmail: "hello@theporticohotel.com",
  },
  footer: {
    brandTagline:
      "A jewel-box behind a Paddington portico. Seventy-three rooms across five floors of W2.",
    fineprintLinks: [
      { label: "Terms & conditions", href: "#" },
      { label: "Privacy policy", href: "#" },
      { label: "Cookie policy", href: "#" },
      { label: "Accessibility", href: "#" },
      { label: "Modern slavery statement", href: "#" },
      { label: "Press", href: "#" },
    ],
  },
};

export function mergeContent(blocks: Array<{ key: string; content: unknown }>): PropertyContent {
  const out: PropertyContent = structuredClone(defaultContent);
  for (const b of blocks) {
    if ((CONTENT_KEYS as readonly string[]).includes(b.key) && b.content && typeof b.content === "object") {
      // Per-key shallow merge — DB row overrides defaults at the field level.
      const k = b.key as ContentKey;
      out[k] = { ...out[k], ...(b.content as Record<string, unknown>) } as never;
    }
  }
  return out;
}
