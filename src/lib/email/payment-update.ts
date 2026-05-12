import { sendEmail } from "./sendgrid";

// Transactional re-auth email. Sent when the auto-charge cron hits an error
// the guest must resolve (e.g. authentication_required → 3DS challenge). The
// link drops the guest at /payment-update/[token] where they can save a new
// card; the next cron run picks the booking back up and re-attempts.
//
// Intentionally bypasses the per-property editable template system — this is
// a critical payment-flow email and we don't want hotel admins editing the
// copy/branding away from the warning we need to communicate. Style mirrors
// the system-default confirmation/cancel emails for visual continuity.

export interface PaymentUpdateEmailArgs {
  to: string;
  guestFirstName: string;
  hotelName: string;
  cloudbedsReservationId: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  grandTotal: number;
  paymentUpdateUrl: string;
}

function currencySymbol(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

export async function sendPaymentUpdateEmail(
  args: PaymentUpdateEmailArgs
): Promise<void> {
  const sym = currencySymbol(args.currency);
  const subject = `Action needed: update card for ${args.hotelName} (${args.cloudbedsReservationId})`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#222;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:8px;">
    <tr><td style="padding:32px;">
      <h1 style="font-size:18px;font-weight:600;margin:0 0 16px;">Update payment method</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Hello ${escapeHtml(args.guestFirstName)},</p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 16px;">
        We tried to charge the card you saved for your stay at <strong>${escapeHtml(args.hotelName)}</strong> but the bank wouldn't authorise it. To keep your reservation we need an updated card within the next 24 hours.
      </p>
      <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:12px 14px;font-size:14px;color:#78350f;margin:0 0 20px;">
        Reservation <strong>${escapeHtml(args.cloudbedsReservationId)}</strong> · ${escapeHtml(args.checkIn)} → ${escapeHtml(args.checkOut)} · ${sym}${args.grandTotal.toFixed(2)}
      </div>
      <p style="margin:0 0 24px;">
        <a href="${args.paymentUpdateUrl}" style="display:inline-block;background:#15252a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;font-size:15px;">Update card</a>
      </p>
      <p style="font-size:13px;line-height:1.5;color:#666;margin:0;">
        If you don't update the card within 24 hours your reservation will be cancelled automatically. No charge has been taken yet.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const text = `Hello ${args.guestFirstName},

We tried to charge the card you saved for your stay at ${args.hotelName} but the bank wouldn't authorise it. To keep your reservation we need an updated card within the next 24 hours.

Reservation: ${args.cloudbedsReservationId}
Stay: ${args.checkIn} → ${args.checkOut}
Total: ${sym}${args.grandTotal.toFixed(2)}

Update card: ${args.paymentUpdateUrl}

If you don't update the card within 24 hours your reservation will be cancelled automatically. No charge has been taken yet.`;

  await sendEmail({
    to: args.to,
    subject,
    html,
    text,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
