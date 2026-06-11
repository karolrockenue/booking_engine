// What the Editorial Calm template renders. Drives template-specific labels
// and required-count hints in the admin Media / Content / Design tabs.
//
// Keep this in sync with what `src/themes/editorial-calm/screens/*` actually
// reads — if you start consuming a new slot in a screen, declare it here.

import type { TemplateSchema } from "@/lib/template-schema";

export const editorialCalmSchema: TemplateSchema = {
  photos: {
    hero: {
      label: "Homepage hero",
      hint: "full-bleed photograph behind the headline + booking form",
      required: true,
      fallback: "If empty, the first Inside-gallery photo is used; otherwise a bundled placeholder.",
    },
    gallery: {
      label: "Inside gallery",
      hint: "three-photo editorial strip on the homepage",
      required: true,
      min: 3,
      fallback: "Falls back to bundled placeholders if empty.",
    },
    neighbourhood: {
      label: "Neighbourhood photo",
      hint: "shown beside the neighbourhood section",
      required: false,
    },
    room: {
      label: "Per-room galleries",
      hint: "carousel on room select + the 1-large/2-stacked collage on rate & extras — 3+ per room type looks best",
      required: true,
      min: 3,
      perRoomType: true,
    },
  },
  content: {
    hero: {
      label: "Hero",
      hint: "mono eyebrow + oversized serif headline",
    },
    neighbourhood: {
      label: "Neighbourhood",
      hint: "location section — title, body, nearby places",
    },
    goodToKnow: {
      label: "Good to know",
      hint: "check-in/out, WiFi, parking …",
    },
    contact: {
      label: "Contact",
      hint: "footer Visit + Contact columns",
    },
    footer: {
      label: "Footer",
      hint: "brand line (also the centred manifesto quote) + fine-print links",
    },
  },
};
