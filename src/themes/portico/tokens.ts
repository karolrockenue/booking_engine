// Portico design tokens — Direction C.
// Two palettes share the same layout/type scale; only colors differ.

import type { PorticoTheme } from "@/lib/active-theme";

export interface PorticoTokens {
  variant: PorticoTheme;
  bg: string;
  bg2: string;
  ink: string;
  inkSoft: string;
  rule: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  // Cinematic dark surfaces — used by the checkout summary panel even on the ivory variant.
  summaryBg: string;
  summaryInk: string;
  summaryRule: string;
  // Hero overlay gradient (lighter on ivory marketing pages, deeper on dark).
  heroOverlay: string;
}

export const portico: Record<PorticoTheme, PorticoTokens> = {
  "portico-ivory": {
    variant: "portico-ivory",
    bg: "#faf8f3",
    bg2: "#faf8f3",
    ink: "#1f1c18",
    inkSoft: "#6b6258",
    rule: "rgba(31, 28, 24, 0.13)",
    accent: "#0e4a4a",
    accentInk: "#faf8f3",
    accentSoft: "#cbd9d2",
    // Cinematic dark surfaces — used by the checkout summary panel and the
    // sticky basket bar to punctuate the otherwise gallery-white flow.
    summaryBg: "#15252a",
    summaryInk: "#ece5d4",
    summaryRule: "rgba(236, 229, 212, 0.14)",
    heroOverlay:
      "linear-gradient(180deg, rgba(8,15,17,0.55) 0%, rgba(8,15,17,0) 30%, rgba(8,15,17,0) 55%, rgba(8,15,17,0.85) 100%)",
  },
};

// Photography paths (web-sized, in public/portico/).
export const porticoImg = {
  hero: "/portico/PorticoHotel_0511.jpg",
  heroAlt: "/portico/PorticoHotel_0518-1.jpg",
  roomDouble: "/portico/PorticoHotel_0510.jpg",
  roomTwin: "/portico/PorticoHotel_0521.jpg",
  roomTriple: "/portico/PorticoHotel_0517.jpg",
  bookSidePane: "/portico/PorticoHotel_0518-1.jpg",
  extrasSidePane: "/portico/PorticoHotel_0524.jpg",
  drawingRoom: "/portico/PorticoHotel_0547.jpg",
} as const;

// Type & layout constants — same for both palettes.
export const porticoLayout = {
  pageGutter: 48,
  navPaddingY: 24,
  navPaddingX: 48,
  cardGap: 24,
  formGap: 22,
  buttonPadding: "14px 26px",
  buttonLetterSpacing: "0.28em",
  buttonFontSize: 10,
} as const;
