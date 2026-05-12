import { sendEmail } from "./sendgrid";

export interface BookingConfirmationEmailArgs {
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
  nightlyRates: Array<{ date: string; rate: number }>;
  extras: Array<{ name: string; priceMinorUnits: number }>;
  // Optional self-cancel link. Only meaningful for Flex bookings — NR
  // doesn't have a self-cancel path. When omitted the email renders without
  // the cancel section.
  cancelUrl?: string;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBookingConfirmationEmail(
  args: BookingConfirmationEmailArgs
): Promise<void> {
  const sym = symbolFor(args.currency);
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  const guestName = `${args.guestFirstName} ${args.guestLastName}`.trim();

  const paymentLine =
    args.rateType === "nr"
      ? `Your card has been charged ${fmt(args.grandTotal)}. This is a non-refundable rate.`
      : `Your card is securely on file. We will charge ${fmt(args.grandTotal)} closer to your check-in date, per the cancellation policy.`;

  const subject = `Booking confirmed at ${args.hotelName} — ${args.cloudbedsReservationId}`;

  const text = [
    `Hi ${args.guestFirstName || "there"},`,
    ``,
    `Your booking at ${args.hotelName} is confirmed.`,
    ``,
    `Reservation number: ${args.cloudbedsReservationId}`,
    `Order ID: ${args.orderId}`,
    ``,
    `Stay`,
    `  Hotel:     ${args.hotelName}`,
    `  Room:      ${args.roomName}`,
    `  Rate:      ${args.rateName}`,
    `  Check-in:  ${formatDate(args.checkIn)}`,
    `  Check-out: ${formatDate(args.checkOut)}`,
    `  Duration:  ${args.nights} night${args.nights !== 1 ? "s" : ""}`,
    `  Guests:    ${args.adults} adult${args.adults !== 1 ? "s" : ""}`,
    ``,
    `Price`,
    ...args.nightlyRates.map(
      (nr) => `  ${formatDate(nr.date)}: ${fmt(nr.rate)}`
    ),
    ...(args.extras.length > 0
      ? [
          ``,
          `Extras`,
          ...args.extras.map(
            (e) => `  ${e.name}: ${fmt(e.priceMinorUnits / 100)}`
          ),
        ]
      : []),
    ``,
    `Total: ${fmt(args.grandTotal)}`,
    ``,
    paymentLine,
    ``,
    ...(args.cancelUrl
      ? [
          `Need to cancel?`,
          `${args.cancelUrl}`,
          ``,
        ]
      : []),
    `If you need to make changes, reply to this email and we'll help.`,
    ``,
    `Thank you,`,
    `${args.hotelName}`,
  ].join("\n");

  const nightlyRows = args.nightlyRates
    .map(
      (nr) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:14px;">${escapeHtml(formatDate(nr.date))}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;font-size:14px;">${fmt(nr.rate)}</td>
        </tr>`
    )
    .join("");

  const extrasRows =
    args.extras.length > 0
      ? `
        <tr>
          <td colspan="2" style="padding:8px 16px;background:#fafafa;border-bottom:1px solid #f0f0f0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Extras</td>
        </tr>
        ${args.extras
          .map(
            (e) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#666;font-size:14px;">${escapeHtml(e.name)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;font-size:14px;">${fmt(e.priceMinorUnits / 100)}</td>
        </tr>`
          )
          .join("")}`
      : "";

  const paymentBadgeBg = args.rateType === "nr" ? "#059669" : "#0369a1";
  const paymentBadgeText = args.rateType === "nr" ? "PAID IN FULL" : "CARD ON FILE";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="padding:32px 32px 24px;background:#1a1a1a;color:#fff;">
          <h1 style="margin:0;font-size:22px;font-weight:600;">Booking confirmed</h1>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">${escapeHtml(args.hotelName)}</p>
        </td></tr>

        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(args.guestFirstName || "there")},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#444;">
            Thanks for booking with ${escapeHtml(args.hotelName)}. We look forward to welcoming you${guestName ? `, ${escapeHtml(guestName)}` : ""}.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;border-radius:6px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Reservation number</div>
              <div style="font-size:18px;font-weight:700;font-family:monospace;margin-top:2px;">${escapeHtml(args.cloudbedsReservationId)}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-top:10px;">Order ID</div>
              <div style="font-size:12px;font-family:monospace;color:#444;margin-top:2px;">${escapeHtml(args.orderId)}</div>
            </td></tr>
          </table>

          <div style="margin-bottom:24px;">
            <span style="display:inline-block;padding:4px 8px;background:${paymentBadgeBg};color:#fff;font-size:11px;font-weight:700;letter-spacing:0.5px;border-radius:3px;vertical-align:middle;">${paymentBadgeText}</span>
            <p style="margin:8px 0 0;font-size:14px;color:#444;line-height:1.5;">${escapeHtml(paymentLine)}</p>
          </div>

          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Stay details</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e0d8;border-radius:6px;margin-bottom:24px;">
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;width:40%;">Hotel</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;">${escapeHtml(args.hotelName)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;">Room</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;">${escapeHtml(args.roomName)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;">Rate</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;">${escapeHtml(args.rateName)}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;">Check-in</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;">${escapeHtml(formatDate(args.checkIn))}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;">Check-out</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;">${escapeHtml(formatDate(args.checkOut))}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#888;">Duration</td>
              <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;">${args.nights} night${args.nights !== 1 ? "s" : ""}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:13px;color:#888;">Guests</td>
              <td style="padding:12px 16px;font-size:14px;font-weight:600;">${args.adults} adult${args.adults !== 1 ? "s" : ""}</td>
            </tr>
          </table>

          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Price breakdown</h3>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e0d8;border-radius:6px;margin-bottom:24px;">
            ${nightlyRows}
            ${extrasRows}
            <tr>
              <td style="padding:14px 16px;background:#fafafa;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total</td>
              <td style="padding:14px 16px;background:#fafafa;text-align:right;font-size:18px;font-weight:700;">${fmt(args.grandTotal)}</td>
            </tr>
          </table>

          ${
            args.cancelUrl
              ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
            <tr><td align="center" style="padding:8px 0 0;">
              <a href="${escapeHtml(args.cancelUrl)}" style="display:inline-block;padding:12px 22px;background:#fff;color:#1a1a1a;border:1px solid #1a1a1a;border-radius:4px;font-size:13px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">Manage or cancel booking</a>
            </td></tr>
          </table>`
              : ""
          }

          <p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.5;">
            Need to make a change? Just reply to this email and we&rsquo;ll help.
          </p>
        </td></tr>

        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;font-size:11px;color:#888;">
          ${escapeHtml(args.hotelName)} &middot; Booking confirmation
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: args.to,
    subject,
    html,
    text,
  });
}
