/**
 * Smoke test for the booking confirmation email.
 *
 * Run with:
 *   set -a && source .env.local && set +a && npx tsx src/scripts/test-confirmation-email.ts <to-address>
 *
 * Sends a single fake confirmation to the address you pass. Verifies:
 *   - SENDGRID_API_KEY is valid
 *   - the From address (noreply@em4689.market-pulse.io) is authenticated
 *   - HTML + text templates render correctly in your inbox
 */

import { sendBookingConfirmationEmail } from "../lib/email/booking-confirmation";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npx tsx src/scripts/test-confirmation-email.ts <to-address>");
    process.exit(1);
  }

  const today = new Date();
  const checkIn = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const checkOut = new Date(today.getTime() + 17 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  console.log(`Sending Flex confirmation to ${to}...`);
  await sendBookingConfirmationEmail({
    to,
    guestFirstName: "Test",
    guestLastName: "Guest",
    hotelName: "Demo Hotel",
    cloudbedsReservationId: "9876543",
    orderId: "test-order-flex-0001",
    rateType: "flex",
    roomName: "Double Room",
    rateName: "Standard Flex Rate",
    checkIn: iso(checkIn),
    checkOut: iso(checkOut),
    nights: 3,
    adults: 2,
    currency: "GBP",
    roomTotal: 360.0,
    extrasTotal: 30.0,
    grandTotal: 390.0,
    nightlyRates: [
      { date: iso(checkIn), rate: 120.0 },
      { date: iso(new Date(checkIn.getTime() + 86400000)), rate: 120.0 },
      { date: iso(new Date(checkIn.getTime() + 2 * 86400000)), rate: 120.0 },
    ],
    extras: [{ name: "Continental Breakfast", priceMinorUnits: 3000 }],
  });
  console.log("  ✓ Flex sent");

  console.log(`Sending NR confirmation to ${to}...`);
  await sendBookingConfirmationEmail({
    to,
    guestFirstName: "Test",
    guestLastName: "Guest",
    hotelName: "Demo Hotel",
    cloudbedsReservationId: "9876544",
    orderId: "test-order-nr-0001",
    rateType: "nr",
    roomName: "Suite",
    rateName: "Non-Refundable Rate",
    checkIn: iso(checkIn),
    checkOut: iso(checkOut),
    nights: 3,
    adults: 2,
    currency: "GBP",
    roomTotal: 540.0,
    extrasTotal: 0,
    grandTotal: 540.0,
    nightlyRates: [
      { date: iso(checkIn), rate: 180.0 },
      { date: iso(new Date(checkIn.getTime() + 86400000)), rate: 180.0 },
      { date: iso(new Date(checkIn.getTime() + 2 * 86400000)), rate: 180.0 },
    ],
    extras: [],
  });
  console.log("  ✓ NR sent");

  console.log("\nDone. Check the inbox (and spam folder) for two emails.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
