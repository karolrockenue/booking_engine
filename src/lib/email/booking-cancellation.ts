import { sendTemplate } from "./send-template";

// Backwards-compatible wrapper. Delegates to the template engine so the
// cancellation HTML comes from the property's editable `cancellation` template.

export interface BookingCancellationEmailArgs {
  propertyId: string;
  bookingId?: string;
  to: string;
  guestFirstName: string;
  guestLastName: string;
  hotelName: string;
  cloudbedsReservationId: string;
  orderId: string;
  roomName: string;
  rateName: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  refunded: boolean;
  refundAmount?: number;
}

function symbolFor(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

export async function sendBookingCancellationEmail(
  args: BookingCancellationEmailArgs
): Promise<void> {
  await sendTemplate({
    propertyId: args.propertyId,
    templateKey: "cancellation",
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
        nights: 0,
        adults: 0,
        children: 0,
        roomName: args.roomName,
        rateName: args.rateName,
        rateType: "flex",
        currency: args.currency,
        symbol: symbolFor(args.currency),
        grandTotal: args.refundAmount ?? 0,
        roomTotal: 0,
        extrasTotal: 0,
      },
      property: {
        name: args.hotelName,
        address: "",
        phone: "",
        email: "",
      },
      links: {},
    },
  });
}
