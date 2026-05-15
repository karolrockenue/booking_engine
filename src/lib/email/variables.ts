// Variable namespace for email templates.
//
// Subject + body support {{var}} substitution. Keys are flat strings, but we
// use dotted names like "guest.firstName" for human readability in the composer
// UI (Unlayer's merge-tags picker shows them grouped by prefix).

export type EmailVarMap = Record<string, string>;

export interface VariableContext {
  guest: { firstName: string; lastName: string; email: string };
  booking: {
    reservationId: string;
    orderId: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    adults: number;
    children: number;
    roomName: string;
    rateName: string;
    rateType: "flex" | "nr";
    currency: string;
    symbol: string;
    grandTotal: number;
    roomTotal: number;
    extrasTotal: number;
  };
  property: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  links: {
    cancel?: string;
    maps?: string;
  };
}

function symbolFor(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildVarMap(ctx: VariableContext): EmailVarMap {
  const sym = ctx.booking.symbol || symbolFor(ctx.booking.currency);
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  return {
    "guest.firstName": ctx.guest.firstName,
    "guest.lastName": ctx.guest.lastName,
    "guest.email": ctx.guest.email,
    "booking.reservationId": ctx.booking.reservationId,
    "booking.orderId": ctx.booking.orderId,
    "booking.checkIn": formatDate(ctx.booking.checkIn),
    "booking.checkOut": formatDate(ctx.booking.checkOut),
    "booking.nights": String(ctx.booking.nights),
    "booking.adults": String(ctx.booking.adults),
    "booking.children": String(ctx.booking.children),
    "booking.roomName": ctx.booking.roomName,
    "booking.rateName": ctx.booking.rateName,
    "booking.rateType": ctx.booking.rateType,
    "booking.currency": ctx.booking.currency,
    "booking.symbol": sym,
    "booking.grandTotal": fmt(ctx.booking.grandTotal),
    "booking.roomTotal": fmt(ctx.booking.roomTotal),
    "booking.extrasTotal": fmt(ctx.booking.extrasTotal),
    "property.name": ctx.property.name,
    "property.address": ctx.property.address,
    "property.phone": ctx.property.phone,
    "property.email": ctx.property.email,
    "links.cancel": ctx.links.cancel ?? "",
    "links.maps": ctx.links.maps ?? "",
  };
}

// Simple {{var}} substitution used for both the subject line AND the cached
// Unlayer-rendered HTML body.
export function substitute(template: string, vars: EmailVarMap): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

// All known variable keys, grouped, for the composer's variable picker panel.
export const VAR_GROUPS = [
  {
    group: "Guest",
    items: [
      { key: "guest.firstName", example: "Karol" },
      { key: "guest.lastName", example: "Marcu" },
      { key: "guest.email", example: "karol@…" },
    ],
  },
  {
    group: "Booking",
    items: [
      { key: "booking.reservationId", example: "CB-29481" },
      { key: "booking.checkIn", example: "Wed, 15 May" },
      { key: "booking.checkOut", example: "Fri, 17 May" },
      { key: "booking.nights", example: "2" },
      { key: "booking.adults", example: "2" },
      { key: "booking.roomName", example: "Double Room" },
      { key: "booking.rateName", example: "Standard" },
      { key: "booking.grandTotal", example: "£320.00" },
      { key: "booking.currency", example: "GBP" },
    ],
  },
  {
    group: "Property",
    items: [
      { key: "property.name", example: "The Portico Hotel" },
      { key: "property.address", example: "32 Sussex Gardens…" },
      { key: "property.phone", example: "+44 20 7402 0190" },
      { key: "property.email", example: "stay@…" },
    ],
  },
  {
    group: "Links",
    items: [
      { key: "links.cancel", example: "signed URL" },
      { key: "links.maps", example: "maps URL" },
    ],
  },
] as const;
