/**
 * Smoke test for the booking confirmation email.
 *
 * Run with:
 *   set -a && source .env.local && set +a && npx tsx src/scripts/test-confirmation-email.ts <to-address> [property-slug]
 *
 * Sends a Flex + NR confirmation to the address you pass. Renders via the
 * Unlayer template engine (so this verifies the template was seeded and the
 * variable substitution works end-to-end). Defaults to property slug "demo".
 */

import { sendBookingConfirmationEmail } from "../lib/email/booking-confirmation";
import { db } from "../db";
import { properties } from "../db/schema";
import { eq } from "drizzle-orm";
import { seedEmailTemplatesForProperty } from "../lib/email/seed-templates";

async function main() {
  const to = process.argv[2];
  const slug = process.argv[3] ?? "demo";
  if (!to) {
    console.error("Usage: npx tsx src/scripts/test-confirmation-email.ts <to-address> [property-slug]");
    process.exit(1);
  }

  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!property) {
    console.error(`No property with slug "${slug}".`);
    process.exit(1);
  }

  // Seed templates if first run for this property.
  const seeded = await seedEmailTemplatesForProperty(property.id);
  if (seeded.templatesInserted > 0) {
    console.log(`Seeded ${seeded.templatesInserted} default templates.`);
  }

  const today = new Date();
  const checkIn = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const checkOut = new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  console.log(`Sending Flex confirmation to ${to}...`);
  await sendBookingConfirmationEmail({
    propertyId: property.id,
    to,
    guestFirstName: "Test",
    guestLastName: "Guest",
    hotelName: property.name,
    cloudbedsReservationId: "9876543",
    orderId: "test-order-flex-0001",
    rateType: "flex",
    roomName: "Double Room",
    rateName: "Standard Flex Rate",
    checkIn: iso(checkIn),
    checkOut: iso(checkOut),
    nights: 3,
    adults: 2,
    currency: property.currency ?? "GBP",
    roomTotal: 360.0,
    extrasTotal: 30.0,
    grandTotal: 390.0,
  });
  console.log("  ✓ Flex sent");

  console.log(`Sending NR confirmation to ${to}...`);
  await sendBookingConfirmationEmail({
    propertyId: property.id,
    to,
    guestFirstName: "Test",
    guestLastName: "Guest",
    hotelName: property.name,
    cloudbedsReservationId: "9876544",
    orderId: "test-order-nr-0001",
    rateType: "nr",
    roomName: "Suite",
    rateName: "Non-Refundable Rate",
    checkIn: iso(checkIn),
    checkOut: iso(checkOut),
    nights: 3,
    adults: 2,
    currency: property.currency ?? "GBP",
    roomTotal: 540.0,
    extrasTotal: 0,
    grandTotal: 540.0,
  });
  console.log("  ✓ NR sent");

  console.log("\nDone. Check the inbox (and spam folder) for two emails.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
