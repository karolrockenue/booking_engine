// What the Portico · Ivory template renders. Drives template-specific labels
// and required-count hints in the admin Media / Content / Design tabs.
//
// Keep this in sync with what `src/themes/portico/screens/*` actually reads —
// if you start consuming a new slot in a screen, declare it here.

import type { TemplateSchema } from "@/lib/template-schema";

export const porticoSchema: TemplateSchema = {
  photos: {
    hero: {
      label: "Homepage hero",
      hint: "above-the-fold image on /",
      required: true,
      fallback: "If empty, the first Inside-gallery photo is used; otherwise a bundled Portico placeholder.",
    },
    gallery: {
      label: "Inside gallery",
      hint: "below-fold editorial gallery section",
      required: true,
      min: 3,
      fallback: "Falls back to 7 bundled Portico placeholders if empty.",
    },
    neighbourhood: {
      label: "Neighbourhood photo",
      hint: "shown next to the map / nearby places",
      required: false,
    },
    room: {
      label: "Per-room galleries",
      hint: "one set per room type",
      required: true,
      perRoomType: true,
    },
  },
  content: {
    hero: {
      label: "Hero",
      hint: "eyebrow, headline, press quote, CTA",
    },
    neighbourhood: {
      label: "Neighbourhood",
      hint: "01 section + map + nearby list",
    },
    goodToKnow: {
      label: "Good to know",
      hint: "03 section — check-in/out, wifi, parking…",
    },
    contact: {
      label: "Contact",
      hint: "footer + confirmation emails",
    },
    footer: {
      label: "Footer",
      hint: "brand line + fine-print legal links",
    },
  },
};
