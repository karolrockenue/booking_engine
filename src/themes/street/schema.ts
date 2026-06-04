// What the Street · Ivory template renders. Drives template-specific labels
// and required-count hints in the admin Media / Content / Design tabs.
//
// Keep this in sync with what `src/themes/street/screens/*` actually reads —
// if you start consuming a new slot in a screen, declare it here.

import type { TemplateSchema } from "@/lib/template-schema";

export const streetSchema: TemplateSchema = {
  photos: {
    hero: {
      label: "Homepage photo",
      hint: "full-bleed band below the header on the homepage",
      required: true,
      fallback: "If empty, the first Inside-gallery photo is used; otherwise a bundled Street placeholder.",
    },
    gallery: {
      label: "Inside gallery",
      hint: "small atmospheric photos used as room-row thumbnails and in the gallery section",
      required: true,
      min: 3,
      fallback: "Falls back to bundled placeholders if empty.",
    },
    neighbourhood: {
      label: "Neighbourhood photo",
      hint: "shown next to the map / nearby places",
      required: false,
    },
    room: {
      label: "Per-room galleries",
      hint: "one small thumbnail per room type — shown next to each room row",
      required: true,
      perRoomType: true,
    },
  },
  content: {
    hero: {
      label: "Hero",
      hint: "eyebrow + italic-accent serif headline (use *word* for the gold italic word)",
    },
    neighbourhood: {
      label: "Neighbourhood",
      hint: "location / map / nearby places",
    },
    goodToKnow: {
      label: "Good to know",
      hint: "check-in/out, WiFi, parking, breakfast …",
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
