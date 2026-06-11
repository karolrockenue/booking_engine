// Editorial Calm design tokens — ported from the Mason & Fifth design
// exploration (export-src/ mockups, signed off 2026-06-10).
//
// Off-white paper ground, near-black ink, warm hairlines, pill buttons.
// Three faces with fixed roles: geometric sans (Hanken Grotesk) for
// structure/titles/prices, serif (Newsreader) for large editorial copy,
// mono (Courier Prime) for bracketed labels / body captions / micro-copy.

import type { EditorialCalmTheme } from "@/lib/active-theme";

export interface EditorialCalmTokens {
  variant: EditorialCalmTheme;

  // Surfaces
  paper: string;   // off-white page background
  ink: string;     // primary type + solid CTAs
  ink70: string;   // secondary text
  ink50: string;   // tertiary text (mono captions, fine print)

  // Hairlines
  line: string;    // default rule
  line2: string;   // slightly stronger rule (field underlines, outlines)

  // Single quiet accent — success / "secured" markers only. Never on CTAs.
  forest: string;

  // Hero photo scrim — keeps white type legible over photography.
  scrim: string;
}

export const editorialCalm: Record<EditorialCalmTheme, EditorialCalmTokens> = {
  "editorial-calm": {
    variant: "editorial-calm",

    paper: "#FAF9F5",
    ink: "#141412",
    ink70: "#3A3A38",
    ink50: "#6E6E69",

    line: "#E4E1D8",
    line2: "#D6D2C6",

    forest: "#1D5D3F",

    scrim:
      "linear-gradient(180deg, rgba(18,20,14,.42) 0%, rgba(18,20,14,.30) 42%, rgba(18,20,14,.55) 100%)",
  },
};

// Bundled photography defaults — the mockup's warm 35mm film set, copied from
// export-src/img/ into public/editorial-calm/. Per-hotel R2 uploads override
// these everywhere they appear, but a fresh property looks like the mockup.
export const ecImg = {
  hero: "/editorial-calm/paper.jpg",
  gallery: [
    "/editorial-calm/bedroom.jpg",
    "/editorial-calm/living.jpg",
    "/editorial-calm/kitchen-bright.jpg",
  ],
  neighbourhood: "/editorial-calm/kitchen-coats.jpg",
  roomFallbacks: [
    "/editorial-calm/rooms/plus-1.jpg",
    "/editorial-calm/rooms/plus-2.jpg",
    "/editorial-calm/rooms/plus-3.jpg",
    "/editorial-calm/rooms/plus-4.jpg",
  ],
  roomFallback: "/editorial-calm/rooms/plus-1.jpg",
} as const;

// Layout constants — the agreed page geometry.
export const ecLayout = {
  pageGutter: 40,
  contentMax: 1280, // rate & extras + checkout container
  wideMax: 1320,    // room-select container
  railWidth: 360,   // basket / summary rail
  railGap: 60,
} as const;
