import { sendTemplate } from "./send-template";

// Backwards-compatible wrapper. Delegates to the template engine so the
// confirmation HTML comes from the property's editable `confirmation` template.

export interface BookingConfirmationEmailArgs {
  propertyId: string;
  bookingId?: string;
  to: string;
  guestFirstName: string;
  guestLastName: string;
  hotelName: string;
  cloudbedsReservationId: string;
  orderId: string;
  rateType: "flex" | "nr";
  roomName: string;
  rateName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  currency: string;
  roomTotal: number;
  extrasTotal: number;
  grandTotal: number;
  extras?: Array<{ name: string; quantity: number; lineTotal: number }>;
  cancelUrl?: string;
}

function symbolFor(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

export async function sendBookingConfirmationEmail(
  args: BookingConfirmationEmailArgs
): Promise<void> {
  await sendTemplate({
    propertyId: args.propertyId,
    templateKey: "confirmation",
    toEmail: args.to,
    bookingId: args.bookingId,
    variables: {
      guest: {
        firstName: args.guestFirstName,
        lastName: args.guestLastName,
        email: args.to,
      },
      booking: {
        reservationId: args.cloudbedsReservationId,
        orderId: args.orderId,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        nights: args.nights,
        adults: args.adults,
        children: 0,
        roomName: args.roomName,
        rateName: args.rateName,
        rateType: args.rateType,
        currency: args.currency,
        symbol: symbolFor(args.currency),
        grandTotal: args.grandTotal,
        roomTotal: args.roomTotal,
        extrasTotal: args.extrasTotal,
        extras: args.extras,
      },
      property: {
        name: args.hotelName,
        address: "",
        phone: "",
        email: "",
      },
      links: {
        cancel: args.cancelUrl,
      },
    },
  });
}
