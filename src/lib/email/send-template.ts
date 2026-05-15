import { db } from "@/db";
import { emailTemplates, emailSends, properties as propertiesTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { sendEmail, DEFAULT_FROM_ADDRESS } from "./sendgrid";
import { renderUnlayerTemplate, renderUnlayerPlainText } from "./unlayer-renderer";
import { buildVarMap, substitute, type VariableContext } from "./variables";
import { getPropertyContent } from "@/lib/get-property";
import { findDefaultTemplate, type TemplateKey } from "./template-defaults";

export interface SendTemplateArgs {
  propertyId: string;
  templateKey: TemplateKey | string;
  toEmail: string;
  bookingId?: string;
  variables: VariableContext;
}

export interface SendTemplateResult {
  status: "sent" | "skipped";
  reason?: string;
  sendId?: string;
  messageId?: string | null;
}

// Single entry point for rendering + dispatching a templated email.
// Loads the template (falls back to default), substitutes vars, sends via
// SendGrid, and inserts an email_sends row. Idempotent on (bookingId, templateKey)
// for non-transactional templates handled by the scheduler.

export async function sendTemplate(
  args: SendTemplateArgs
): Promise<SendTemplateResult> {
  // 1. Load template (DB > default fallback)
  const [dbTemplate] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.propertyId, args.propertyId),
        eq(emailTemplates.key, args.templateKey)
      )
    )
    .limit(1);

  const fallback = findDefaultTemplate(args.templateKey);
  if (!dbTemplate && !fallback) {
    return { status: "skipped", reason: `unknown_template:${args.templateKey}` };
  }

  const subjectTemplate = dbTemplate?.subject ?? fallback!.subject;
  const html = (dbTemplate?.htmlCached ?? fallback?.html) as string | null;
  const status = dbTemplate?.status ?? fallback!.status;
  if (status === "disabled" || status === "draft") {
    return { status: "skipped", reason: `template_${status}` };
  }
  if (!html) {
    return { status: "skipped", reason: "template_html_missing" };
  }

  // 2. Load property + content for sender / contact fallback
  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, args.propertyId))
    .limit(1);
  if (!property) return { status: "skipped", reason: "property_not_found" };

  const content = await getPropertyContent(args.propertyId);

  // Fill in missing property fields from content blocks where the caller didn't
  // pass them explicitly. Callers (booking flow, scheduler) can override.
  const enrichedVars: VariableContext = {
    ...args.variables,
    property: {
      name: args.variables.property.name || property.name,
      address:
        args.variables.property.address ||
        content.contact.addressLines.join(", "),
      phone:
        args.variables.property.phone || content.contact.reservationsPhone,
      email:
        args.variables.property.email || content.contact.reservationsEmail,
    },
  };

  const varMap = buildVarMap(enrichedVars);
  const subject = substitute(subjectTemplate, varMap);

  // 3. Render
  const renderedHtml = renderUnlayerTemplate({ html, vars: varMap });
  const text = renderUnlayerPlainText({ html, vars: varMap });

  // 4. Insert email_sends row (queued)
  const [sendRow] = await db
    .insert(emailSends)
    .values({
      propertyId: args.propertyId,
      bookingId: args.bookingId,
      templateKey: args.templateKey,
      toEmail: args.toEmail,
      fromEmail: property.emailFromAddress ?? DEFAULT_FROM_ADDRESS,
      subject,
      status: "queued",
    })
    .returning();

  // 5. Dispatch (fail-soft — caller decides whether to throw)
  try {
    const { messageId } = await sendEmail({
      to: args.toEmail,
      subject,
      html: renderedHtml,
      text,
      from: property.emailFromAddress ?? undefined,
      fromName: property.emailFromName ?? property.name,
      replyTo: property.emailReplyTo ?? property.emailFromAddress ?? undefined,
      customArgs: {
        send_id: sendRow.id,
        property_id: args.propertyId,
        template_key: args.templateKey,
        ...(args.bookingId ? { booking_id: args.bookingId } : {}),
      },
    });
    await db
      .update(emailSends)
      .set({ status: "sent", sentAt: new Date(), sendgridMessageId: messageId })
      .where(eq(emailSends.id, sendRow.id));
    return { status: "sent", sendId: sendRow.id, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(emailSends)
      .set({ status: "failed", errorMessage: message })
      .where(eq(emailSends.id, sendRow.id));
    throw err;
  }
}
