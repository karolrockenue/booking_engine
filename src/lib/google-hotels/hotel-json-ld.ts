// Google hotel-price structured data (JSON-LD) for the /rooms landing page.
//
// Emits schema.org `Hotel` with a `makesOffer` carrying the lowest available
// total for the queried dates. The price is computed via the SAME
// `computeAvailability` the booking page uses, so the JSON-LD price always
// equals what the guest sees — required by Google's price-accuracy policy.
//
// See "Google Hotel Center — Blueprint.md" §2/§5/§11.

import { db } from "@/db";
import { contentBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { computeAvailability } from "@/lib/booking/availability";
import { parseAddress } from "./hotel-list-feed";
import type { ContactBlock } from "./types";

interface HotelJsonLdInput {
  property: { id: string; name: string; currency: string | null };
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  adults: number;
}

// Default check-in/out clock times until real per-hotel times are wired
// (they live in content_blocks.goodToKnow — a later improvement).
const DEFAULT_CHECKIN_TIME = "15:00:00";
const DEFAULT_CHECKOUT_TIME = "11:00:00";

export async function buildHotelJsonLd({
  property,
  checkIn,
  checkOut,
  adults,
}: HotelJsonLdInput): Promise<Record<string, unknown>> {
  const blocks = await db
    .select()
    .from(contentBlocks)
    .where(eq(contentBlocks.propertyId, property.id));
  const contact = (blocks.find((b) => b.key === "contact")?.content ??
    {}) as ContactBlock;
  const addr = parseAddress(contact.addressLines);

  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
    addressCountry: addr.country,
  };
  if (addr.addr1) address.streetAddress = addr.addr1;
  if (addr.city) address.addressLocality = addr.city;
  if (addr.postal) address.postalCode = addr.postal;

  const hotel: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: property.name,
    identifier: `roc-${property.id}`,
    address,
  };

  // Lowest available total for the stay (the headline "from" price).
  const results = await computeAvailability(
    property.id,
    checkIn,
    checkOut,
    adults
  );
  let lowest: number | null = null;
  for (const r of results) {
    if (lowest === null || r.totalPrice < lowest) lowest = r.totalPrice;
  }

  if (lowest !== null) {
    hotel.makesOffer = {
      "@type": ["Offer", "LodgingReservation"],
      checkinTime: `${checkIn} ${DEFAULT_CHECKIN_TIME}`,
      checkoutTime: `${checkOut} ${DEFAULT_CHECKOUT_TIME}`,
      priceSpecification: {
        "@type": "CompoundPriceSpecification",
        price: Number(lowest.toFixed(2)),
        priceCurrency: property.currency ?? "GBP",
      },
    };
  }

  return hotel;
}
