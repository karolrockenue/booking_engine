// What the Editorial Calm template renders. Drives template-specific labels
// and required-count hints in the admin Media / Content / Design tabs.
//
// Keep this in sync with what `src/themes/editorial-calm/screens/*` actually
// reads — if you start consuming a new slot in a screen, declare it here.
// The homepage is a pixel-faithful port of the mockup: hero + houses
// sequence + manifesto + newsletter + footer (no neighbourhood / good-to-know
// sections — those content blocks are not rendered by this template).

import type { TemplateSchema } from "@/lib/template-schema";

export const editorialCalmSchema: TemplateSchema = {
  photos: {
    hero: {
      label: "Homepage hero",
      hint: "full-bleed photograph behind the headline + booking form (cropped at 50%/35%)",
      required: true,
      fallback: "If empty, the first gallery photo is used; otherwise the bundled mockup photo.",
    },
    gallery: {
      label: "Houses sequence",
      hint: "the three large photos in the 'Our houses' editorial sequence, in order",
      required: true,
      min: 3,
      fallback: "Falls back to the bundled mockup photos if empty.",
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
      hint: "mono eyebrow + serif headline; press-quote fields double as the centred manifesto",
    },
    contact: {
      label: "Contact",
      hint: "long-stay enquiry email + footer Contact link",
    },
    footer: {
      label: "Footer",
      hint: "brand tagline under the footer wordmark",
    },
  },
};
