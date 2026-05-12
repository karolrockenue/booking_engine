import { sendEmail } from "./sendgrid";

export interface BookingCancellationEmailArgs {
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

export async function sendBookingCancellationEmail(
  args: BookingCancellationEmailArgs
): Promise<void> {
  const sym = symbolFor(args.currency);
  const guestName = `${args.guestFirstName} ${args.guestLastName}`.trim();

  const refundLine = args.refunded
    ? `A refund of ${sym}${(args.refundAmount ?? 0).toFixed(2)} has been issued. It typically appears on your statement within 5–10 business days.`
    : `No charge was taken for this booking, so there's nothing to refund.`;

  const subject = `Cancellation confirmed — ${args.hotelName} — ${args.cloudbedsReservationId}`;

  const text = [
    `Hi ${args.guestFirstName || "there"},`,
    ``,
    `Your booking at ${args.hotelName} has been cancelled.`,
    ``,
    `Reservation number: ${args.cloudbedsReservationId}`,
    `Order ID: ${args.orderId}`,
    ``,
    `Cancelled stay`,
    `  Hotel:     ${args.hotelName}`,
    `  Room:      ${args.roomName}`,
    `  Rate:      ${args.rateName}`,
    `  Check-in:  ${formatDate(args.checkIn)}`,
    `  Check-out: ${formatDate(args.checkOut)}`,
    ``,
    refundLine,
    ``,
    `If you cancelled by mistake, just reply to this email and we'll do our best to reinstate the booking — subject to availability.`,
    ``,
    `We hope to welcome you another time,`,
    `${args.hotelName}`,
  ].join("\n");

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
          <h1 style="margin:0;font-size:22px;font-weight:600;">Booking cancelled</h1>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.7);">${escapeHtml(args.hotelName)}</p>
        </td></tr>

        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(args.guestFirstName || "there")},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#444;">
            Your booking at ${escapeHtml(args.hotelName)}${guestName ? `, ${escapeHtml(guestName)}` : ""} has been cancelled.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;border-radius:6px;margin-bottom:24px;">
            <tr><td style="padding:16px 20px;">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Reservation number</div>
              <div style="font-size:18px;font-weight:700;font-family:monospace;margin-top:2px;">${escapeHtml(args.cloudbedsReservationId)}</div>
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin-top:10px;">Order ID</div>
              <div style="font-size:12px;font-family:monospace;color:#444;margin-top:2px;">${escapeHtml(args.orderId)}</div>
            </td></tr>
          </table>

          <div style="margin-bottom:24px;padding:14px 16px;background:${args.refunded ? "#ecfdf5" : "#f9fafb"};border:1px solid ${args.refunded ? "#a7f3d0" : "#e5e7eb"};border-radius:6px;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${args.refunded ? "#065f46" : "#374151"};">${args.refunded ? "Refund issued" : "No charge taken"}</div>
            <p style="margin:6px 0 0;font-size:14px;color:#444;line-height:1.5;">${escapeHtml(refundLine)}</p>
          </div>

          <h3 style="margin:0 0 12px;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#888;">Cancelled stay</h3>
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
              <td style="padding:12px 16px;font-size:13px;color:#888;">Check-out</td>
              <td style="padding:12px 16px;font-size:14px;font-weight:600;">${escapeHtml(formatDate(args.checkOut))}</td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:13px;color:#666;line-height:1.5;">
            Cancelled by mistake? Reply to this email and we&rsquo;ll try to reinstate the booking, subject to availability.
          </p>
        </td></tr>

        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;font-size:11px;color:#888;">
          ${escapeHtml(args.hotelName)} &middot; Cancellation confirmation
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
