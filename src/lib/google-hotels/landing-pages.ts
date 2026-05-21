// Google Landing Pages (formerly "Point of Sale") feed (Sprint 4).
//
// A single <PointsOfSale> config that tells Google how to build the deep-link
// URL into our booking flow. Google substitutes the (MACRO) tokens at click
// time. The per-hotel routing key is (ALTERNATE-HOTEL-ID) = our slug (emitted
// as client_attr alternate_hotel_id in the Hotel List feed). The XML root is
// <PointsOfSale> for backward compatibility (the product was renamed to
// Landing Pages).
//
// v1 deep-links to the platform host + slug. When hotels move to their own
// domains, the host/template changes (future). See blueprint §4/§5/§11.

// Where the booking flow lives. Overridable for staging; defaults to the
// platform host.
const LANDING_HOST = (
  process.env.GOOGLE_LANDING_HOST ?? "https://app.rockenue.tech"
).replace(/\/+$/, "");

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildLandingPagesFeed(): { xml: string; url: string } {
  // Raw URL template with Google's substitution macros. & is XML-escaped in
  // the <URL> element below.
  const url =
    `${LANDING_HOST}/(ALTERNATE-HOTEL-ID)/rooms` +
    `?checkIn=(CHECKINYEAR)-(CHECKINMONTH)-(CHECKINDAY)` +
    `&checkOut=(CHECKOUTYEAR)-(CHECKOUTMONTH)-(CHECKOUTDAY)` +
    `&adults=(NUM-ADULTS)` +
    `&children=(NUM-CHILDREN)`;

  const xml =
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<PointsOfSale>`,
      `  <PointOfSale id="rockenue">`,
      `    <Match status="yes"/>`,
      `    <URL>${esc(url)}</URL>`,
      `  </PointOfSale>`,
      `</PointsOfSale>`,
    ].join("\n") + "\n";

  return { xml, url };
}
