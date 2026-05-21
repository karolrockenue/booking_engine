// Google Hotel Prices <Transaction> message generators (Sprint 5 foundation).
//
//  - Property Data: <Transaction> + <PropertyDataSet> describing the hotel's
//    rooms (so Google knows what rooms/packages exist).
//  - Price overlay: <Transaction> + one <Result> per itinerary carrying an
//    all-inclusive <Baserate> (computed via the SHARED computeAvailability, so
//    the pushed price matches the booking page + the JSON-LD). VAT/3% are
//    already inside the rate (see Google blueprint §3), so we emit a single
//    all-inclusive Baserate and no <Tax>.
//
// The OTA_Hotel*NotifRQ incremental rate/avail/inventory messages are a separate
// (pending) piece — see blueprint §11. See Google docs: xml-reference/transaction-messages.

import { db } from "@/db";
import { roomTypes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { computeAvailability } from "@/lib/booking/availability";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function nowStamp(): string {
  return new Date().toISOString();
}

interface PropertyForAri {
  id: string;
  name: string;
  cloudbedsPropertyId: string | null;
  currency: string | null;
}

// The hotel id we feed Google = the Hotel List feed <id> (PARTNER-HOTEL-ID).
function partnerHotelId(propertyId: string): string {
  return `roc-${propertyId}`;
}

// --- Property Data: which rooms exist ---
export async function buildPropertyDataTransaction(
  property: PropertyForAri
): Promise<string> {
  const rooms = await db
    .select()
    .from(roomTypes)
    .where(
      and(
        eq(roomTypes.propertyId, property.id),
        eq(roomTypes.hiddenFromBooking, false)
      )
    );

  const roomLines = rooms
    .map((r) =>
      [
        `      <RoomData>`,
        `        <RoomID>${esc(r.otaRoomId)}</RoomID>`,
        `        <Name>`,
        `          <Text text="${esc(r.name)}" language="en"/>`,
        `        </Name>`,
        r.maxOccupancy
          ? `        <Capacity><Adults>${r.maxOccupancy}</Adults></Capacity>`
          : ``,
        `      </RoomData>`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");

  return (
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<Transaction timestamp="${nowStamp()}" id="${esc(partnerHotelId(property.id))}-propdata">`,
      `  <PropertyDataSet>`,
      `    <Property>${esc(partnerHotelId(property.id))}</Property>`,
      roomLines,
      `  </PropertyDataSet>`,
      `</Transaction>`,
    ].join("\n") + "\n"
  );
}

// --- Price overlay: <Result> per itinerary (lowest available all-inclusive rate) ---
export interface Itinerary {
  checkIn: string; // YYYY-MM-DD
  nights: number;
  adults: number;
}

export async function buildPriceTransaction(
  property: PropertyForAri,
  itineraries: Itinerary[]
): Promise<{ xml: string; results: number }> {
  const currency = property.currency ?? "GBP";
  const blocks: string[] = [];

  for (const it of itineraries) {
    const checkOut = addDays(it.checkIn, it.nights);
    const avail = await computeAvailability(
      property.id,
      it.checkIn,
      checkOut,
      it.adults
    );
    let lowest: number | null = null;
    for (const r of avail) if (lowest === null || r.totalPrice < lowest) lowest = r.totalPrice;
    if (lowest === null) continue; // nothing available → no Result for this itinerary

    blocks.push(
      [
        `  <Result>`,
        `    <Property>${esc(partnerHotelId(property.id))}</Property>`,
        `    <Checkin>${esc(it.checkIn)}</Checkin>`,
        `    <Nights>${it.nights}</Nights>`,
        `    <Baserate currency="${esc(currency)}">${lowest.toFixed(2)}</Baserate>`,
        `  </Result>`,
      ].join("\n")
    );
  }

  const xml =
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<Transaction timestamp="${nowStamp()}" id="${esc(partnerHotelId(property.id))}-prices">`,
      ...blocks,
      `</Transaction>`,
    ].join("\n") + "\n";

  return { xml, results: blocks.length };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
