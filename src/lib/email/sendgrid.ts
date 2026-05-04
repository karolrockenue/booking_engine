import sgMail from "@sendgrid/mail";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

const FROM_ADDRESS = "noreply@em4689.market-pulse.io";
const FROM_NAME = "Bookings";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("SENDGRID_API_KEY is not set");
  sgMail.setApiKey(key);
  configured = true;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  ensureConfigured();
  await sgMail.send({
    to: args.to,
    from: { email: FROM_ADDRESS, name: FROM_NAME },
    replyTo: args.replyTo ?? FROM_ADDRESS,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
}
