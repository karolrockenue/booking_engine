// Editorial Calm seed copy — the Mason & Fifth voice from the export-src
// mockups, verbatim where the mockup had copy. These are the template's
// DEFAULTS: any content block the hotel saves in the admin overrides the
// matching fields, so other hotels on this template replace this voice
// with their own.

import type { PropertyContent } from "@/lib/content-defaults";
import { defaultContent } from "@/lib/content-defaults";

export const ecDefaultContent: PropertyContent = {
  hero: {
    eyebrow: "London · Nightly & Monthly",
    headline: "A little less ordinary.",
    // pressQuote doubles as the centred manifesto on the homepage.
    pressQuote:
      "Everything you need, nothing you don't. A bed that feels like yours, a kitchen that smells like dinner, neighbours who know your name — and London, just outside the door.",
    pressQuoteAttribution: "The Mason & Fifth way",
    bookCtaLabel: "Book a stay",
  },
  neighbourhood: {
    eyebrow: "01 — The neighbourhood",
    title: "Leafy streets, the heath\nand proper coffee.",
    body:
      "Our houses sit in the London neighbourhoods we'd actually live in — village streets, morning markets and parks on the doorstep. Stay a night or settle for a season; either way, the city is just outside the door.",
    nearby: [
      { place: "The local bakery", dist: "2 min walk" },
      { place: "Regent's Canal", dist: "5 min walk" },
      { place: "Primrose Hill", dist: "8 min walk" },
      { place: "Hampstead Heath", dist: "12 min walk" },
      { place: "Central London", dist: "15 min by tube" },
    ],
    // 0/0 hides the map until the hotel sets real coordinates in the admin.
    mapLat: 0,
    mapLon: 0,
  },
  goodToKnow: {
    eyebrow: "02 — Good to know",
    title: "The practicalities.",
    rows: [
      { label: "Check-in", value: "From 3pm" },
      { label: "Check-out", value: "By 11am" },
      { label: "Wi-Fi", value: "Included throughout" },
      { label: "Kitchen", value: "Every studio has its own" },
      { label: "Laundry", value: "In-house, free to use" },
      { label: "The Grounding", value: "Weekly breath-work, on us" },
      { label: "Bikes", value: "House bikes to borrow" },
      { label: "Pets", value: "Small dogs by arrangement" },
    ],
  },
  contact: {
    addressLines: ["Belsize", "London"],
    receptionLine: "Hosts on site, morning to evening",
    reservationsPhone: "",
    reservationsEmail: "",
    generalEmail: "",
  },
  footer: {
    brandTagline:
      "Boutique guesthouses for a life well-lived. London, yours to call home.",
    fineprintLinks: defaultContent.footer.fineprintLinks,
  },
};
