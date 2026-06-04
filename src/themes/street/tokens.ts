// Street design tokens — cinematic-light direction.
//
// Same warm ivory ground as Portico (`#faf8f3`) but a different layout DNA:
// photo strip + below-fold serif headline, borderless underline inputs,
// ghost-bordered buttons, single warm gold accent. Budget / limited-service
// hotel direction — value-forward, mobile-first, conversion-tested.

import type { StreetTheme } from "@/lib/active-theme";

export interface StreetTokens {
  variant: StreetTheme;

  // Surfaces
  bg: string;        // warm ivory page background
  bg2: string;       // alt surface (cards, recap bars)
  ink: string;       // primary text + ghost-button border
  inkSoft: string;   // secondary text (labels, eyebrows, facts)
  inkMuted: string;  // tertiary text (timestamps, fineprint)

  // Hairlines
  rule: string;      // 1px hairline between rows / under inputs
  ruleSoft: string;  // even softer rule for inner card dividers

  // Single warm accent — used for italic headline words, active-nav rules,
  // checkmarks, and the active tab indicator. Never used for solid CTAs.
  accent: string;
  accentInk: string; // contrast colour on a solid accent background (rare)

  // Hero overlay — very light; the photo should breathe, not be dimmed.
  heroOverlay: string;
}

export const street: Record<StreetTheme, StreetTokens> = {
  "street-ivory": {
    variant: "street-ivory",

    bg: "#faf8f3",
    bg2: "#f5f2eb",
    ink: "#1a1f29",
    inkSoft: "#4a5165",
    inkMuted: "#8892a0",

    rule: "rgba(26, 31, 41, 0.13)",
    ruleSoft: "rgba(26, 31, 41, 0.07)",

    accent: "#b08a3e",
    accentInk: "#faf8f3",

    // Almost-no overlay — photo legibility relies on its own composition,
    // not a darkening wash. Used only where headline copy sits over the photo.
    heroOverlay:
      "linear-gradient(180deg, rgba(250, 248, 243, 0) 50%, rgba(250, 248, 243, 0.35) 100%)",
  },
};

// Default photography fallbacks (web-sized, in public/street/). Per-hotel
// uploads in R2 override these. Currently a single bundled London street
// shot (Regent Street, courtesy Unsplash / Harry Shelton) — every hotel
// without a hero uploaded will show this.
export const streetImg = {
  hero: "/street/hero-default.jpg",
  roomFallback: "/street/hero-default.jpg",
} as const;

// Layout / type constants — shared across any future Street variant.
export const streetLayout = {
  pageGutter: 40,        // outer page padding (px)
  navPaddingY: 20,
  navPaddingX: 40,
  heroHeight: 560,       // homepage photo band
  contentMax: 1200,      // max content width
  rowGap: 36,            // vertical room-row spacing
  buttonPadding: "14px 26px",
  buttonLetterSpacing: "0.22em",
  buttonFontSize: 11.5,
} as const;
