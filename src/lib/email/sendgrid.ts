import sgMail from "@sendgrid/mail";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Per-property sender; falls back to platform defaults when undefined.
  from?: string;
  fromName?: string;
  replyTo?: string;
  // Custom args appear in SendGrid Event Webhook payloads — we use them to
  // correlate webhook events back to email_sends rows.
  customArgs?: Record<string, string>;
}

export const DEFAULT_FROM_ADDRESS = "noreply@em4689.market-pulse.io";
export const DEFAULT_FROM_NAME = "Bookings";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY is not set");
  sgMail.setApiKey(key);
  configured = true;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ messageId: string | null }> {
  ensureConfigured();
  const from = args.from ?? DEFAULT_FROM_ADDRESS;
  const fromName = args.fromName ?? DEFAULT_FROM_NAME;
  const [response] = await sgMail.send({
    to: args.to,
    from: { email: from, name: fromName },
    replyTo: args.replyTo ?? from,
    subject: args.subject,
    html: args.html,
    text: args.text,
    customArgs: args.customArgs,
  });
  // SendGrid returns the message id in the x-message-id header.
  const headers = response?.headers as Record<string, string> | undefined;
  const messageId = headers?.["x-message-id"] ?? null;
  return { messageId };
}
