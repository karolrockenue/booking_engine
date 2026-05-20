import type { EmailFontStacks } from "./fonts";

// We don't pull JSONTemplate from @unlayer/types — the type is too tight for
// hand-rolled seed designs (it expects every BodyValues field including
// _styleGuide / language). Unlayer's editor only requires `counters`, `body.rows`
// and `body.values.contentWidth` at load time and fills the rest itself.
type UnlayerDesign = Record<string, unknown>;

// Default templates seeded per property. Each ships TWO representations:
//
//   • design — Unlayer JSONTemplate the composer loads when admin opens it.
//     Plain content blocks (heading + paragraph + divider + button) that the
//     visual builder can re-render and re-export.
//   • html   — pre-rendered HTML with {{var}} tokens. Used at send time. When
//     admin saves in the composer, Unlayer's exportHtml() overwrites this.
//
// Brand fonts (Cormorant Garamond + Inter for Portico) are baked into both the
// design (via per-block fontFamily) and the HTML (via inline style). The
// renderer never strips them.

export type TemplateKey =
  | "confirmation"
  | "cancellation"
  | "pre_arrival"
  | "welcome"
  | "post_stay";

export interface DefaultTemplate {
  key: TemplateKey;
  name: string;
  subject: string;
  isTransactional: boolean;
  status: "active" | "draft";
  design: UnlayerDesign;
  html: string;
  defaultSchedule?: {
    enabled: boolean;
    trigger: "arrival" | "checkout";
    offsetDays: number;
    timeOfDay: string;
    audience: "all" | "flex" | "nr" | "min_nights_2";
  };
}

// ─── Unlayer design builder ──────────────────────────────────────────────
//
// Unlayer's JSONTemplate shape is verbose; we only need a fraction of it for
// seed templates. Anything we omit gets filled by the editor's defaults at
// load time. The fields we DO set are font + colour overrides that have to
// be authoritative on the seeded row.

interface Block {
  kind: "heading" | "text" | "divider" | "button";
  text?: string;
  level?: 1 | 2 | 3;
  href?: string;
  font: "head" | "body";
}

interface BuilderArgs {
  fonts: EmailFontStacks;
  blocks: Block[];
  preheader?: string;
}

function fontLabel(stack: string): {
  label: string;
  value: string;
} {
  const primary = stack.split(",")[0].replace(/^["']|["']$/g, "").trim();
  return {
    label: primary,
    value: stack,
  };
}

function buildDesign(args: BuilderArgs): UnlayerDesign {
  const head = fontLabel(args.fonts.headingStack);
  const body = fontLabel(args.fonts.bodyStack);

  let textCounter = 0;
  let headingCounter = 0;
  let dividerCounter = 0;
  let buttonCounter = 0;

  const contents = args.blocks.map((block, idx) => {
    if (block.kind === "heading") {
      headingCounter++;
      return {
        id: `u_content_heading_${headingCounter}`,
        type: "heading",
        values: {
          containerPadding: "10px",
          headingType: `h${block.level ?? 1}`,
          fontFamily: head,
          fontSize: block.level === 2 ? "20px" : "28px",
          textAlign: "left",
          lineHeight: "120%",
          color: "#15252a",
          text: block.text ?? "",
          _meta: { htmlID: `u_content_heading_${headingCounter}`, htmlClassNames: "u_content_heading" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      };
    }
    if (block.kind === "divider") {
      dividerCounter++;
      return {
        id: `u_content_divider_${dividerCounter}`,
        type: "divider",
        values: {
          width: "100%",
          border: { borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "#e6e1d8" },
          textAlign: "center",
          containerPadding: "10px",
          _meta: { htmlID: `u_content_divider_${dividerCounter}`, htmlClassNames: "u_content_divider" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      };
    }
    if (block.kind === "button") {
      buttonCounter++;
      return {
        id: `u_content_button_${buttonCounter}`,
        type: "button",
        values: {
          containerPadding: "10px",
          href: { name: "web", values: { href: block.href ?? "#", target: "_blank" } },
          buttonColors: { color: "#FFFFFF", backgroundColor: "#15252a", hoverColor: "#FFFFFF", hoverBackgroundColor: "#0c1416" },
          size: { autoWidth: true, width: "100%" },
          fontFamily: body,
          fontSize: "14px",
          textAlign: "left",
          lineHeight: "120%",
          padding: "12px 24px",
          border: {},
          borderRadius: "2px",
          text: `<span style="font-size: 14px; line-height: 16.8px;">${block.text ?? "Click"}</span>`,
          calculatedWidth: 0,
          calculatedHeight: 0,
          _meta: { htmlID: `u_content_button_${buttonCounter}`, htmlClassNames: "u_content_button" },
          selectable: true,
          draggable: true,
          duplicatable: true,
          deletable: true,
          hideable: true,
        },
      };
    }
    // text (paragraph)
    textCounter++;
    return {
      id: `u_content_text_${textCounter}`,
      type: "text",
      values: {
        containerPadding: "8px 10px",
        fontFamily: body,
        fontSize: "15px",
        textAlign: "left",
        lineHeight: "150%",
        color: "#2a2a2a",
        text: `<p style="line-height: 150%;">${block.text ?? ""}</p>`,
        _meta: { htmlID: `u_content_text_${textCounter}`, htmlClassNames: "u_content_text" },
        selectable: true,
        draggable: true,
        duplicatable: true,
        deletable: true,
        hideable: true,
      },
    };
  });

  return {
    counters: {
      u_row: 1,
      u_column: 1,
      u_content_heading: headingCounter,
      u_content_text: textCounter,
      u_content_divider: dividerCounter,
      u_content_button: buttonCounter,
    },
    body: {
      id: "u_body",
      rows: [
        {
          id: "u_row_1",
          cells: [1],
          columns: [
            {
              id: "u_column_1",
              contents,
              values: {
                backgroundColor: "",
                padding: "0px",
                border: {},
                borderRadius: "0px",
                _meta: { htmlID: "u_column_1", htmlClassNames: "u_column" },
              },
            },
          ],
          values: {
            displayCondition: null,
            columns: false,
            backgroundColor: "",
            columnsBackgroundColor: "",
            backgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "custom", position: "center" },
            padding: "20px",
            anchor: "",
            hideDesktop: false,
            _meta: { htmlID: "u_row_1", htmlClassNames: "u_row" },
            selectable: true,
            draggable: true,
            duplicatable: true,
            deletable: true,
            hideable: true,
          },
        },
      ],
      values: {
        popupPosition: "center",
        popupWidth: "600px",
        popupHeight: "auto",
        borderRadius: "10px",
        contentAlign: "center",
        contentVerticalAlign: "center",
        contentWidth: "600px",
        fontFamily: body,
        textColor: "#2a2a2a",
        popupBackgroundColor: "#FFFFFF",
        popupBackgroundImage: { url: "", fullWidth: true, repeat: "no-repeat", size: "cover", position: "center" },
        popupOverlay_backgroundColor: "rgba(0, 0, 0, 0.1)",
        popupCloseButton_position: "top-right",
        popupCloseButton_backgroundColor: "#DDDDDD",
        popupCloseButton_iconColor: "#000000",
        popupCloseButton_borderRadius: "0px",
        popupCloseButton_margin: "0px",
        popupCloseButton_action: { name: "close_popup", attrs: { onClick: "" } },
        backgroundColor: "#f7f5ef",
        preheaderText: args.preheader ?? "",
        linkStyle: { body: true, linkColor: "#15252a", linkHoverColor: "#0c1416", linkUnderline: true, linkHoverUnderline: true },
        _meta: { htmlID: "u_body", htmlClassNames: "u_body" },
      },
    },
    schemaVersion: 16,
  };
}

// ─── Hand-rolled HTML for each template ──────────────────────────────────
// These are sent to SendGrid as-is at first send; admin can overwrite by
// opening the composer + saving. {{var}} tokens are substituted at send time.

function htmlShell(args: { fonts: EmailFontStacks; preheader: string; inner: string }): string {
  const { fonts, preheader, inner } = args;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title></title>
<style>
  body{margin:0;padding:0;background:#f7f5ef;font-family:${fonts.bodyStack};color:#2a2a2a;}
  .wrap{width:100%;background:#f7f5ef;}
  .container{max-width:600px;margin:0 auto;background:#ffffff;}
  .pad{padding:32px 36px;}
  h1{font-family:${fonts.headingStack};font-weight:500;font-size:28px;line-height:120%;margin:0 0 16px;color:#15252a;}
  h2{font-family:${fonts.headingStack};font-weight:500;font-size:20px;line-height:120%;margin:24px 0 8px;color:#15252a;}
  p{font-family:${fonts.bodyStack};font-size:15px;line-height:150%;margin:0 0 12px;color:#2a2a2a;}
  .row{font-family:${fonts.bodyStack};font-size:14px;line-height:160%;margin:0;color:#2a2a2a;}
  .row .label{color:#737373;}
  .hr{border:0;border-top:1px solid #e6e1d8;margin:20px 0;}
  .btn{display:inline-block;background:#15252a;color:#ffffff !important;font-family:${fonts.bodyStack};font-size:14px;line-height:16px;padding:12px 24px;border-radius:2px;text-decoration:none;}
  a{color:#15252a;}
</style></head>
<body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table class="wrap" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
  <table class="container" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td class="pad">
${inner}
  </td></tr></table>
</td></tr></table>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<p class="row"><span class="label">${label}: </span>${value}</p>`;
}

export function buildDefaultTemplates(fonts: EmailFontStacks): DefaultTemplate[] {
  // ─── 1. Booking confirmation ─────────────────────────────────────────
  const confirmationHtml = htmlShell({
    fonts,
    preheader: "Your booking at {{property.name}} is confirmed",
    inner: `
<h1>Booking confirmed</h1>
<p>Hi {{guest.firstName}},</p>
<p>Thanks for booking with {{property.name}}. Your reservation is confirmed.</p>
<h2>Reservation</h2>
${row("Reservation #", "{{booking.reservationId}}")}
${row("Room", "{{booking.roomName}}")}
${row("Rate", "{{booking.rateName}}")}
${row("Check-in", "{{booking.checkIn}}")}
${row("Check-out", "{{booking.checkOut}}")}
${row("Guests", "{{booking.adults}}")}
${row("Total", "{{booking.grandTotal}}")}
<hr class="hr">
{{links.cancelBlock}}
<p>Need to make a change? Reply to this email and we'll help. We look forward to welcoming you to {{property.name}}.</p>
`,
  });
  const confirmationDesign = buildDesign({
    fonts,
    preheader: "Your booking at {{property.name}} is confirmed",
    blocks: [
      { kind: "heading", text: "Booking confirmed", level: 1, font: "head" },
      { kind: "text", text: "Hi {{guest.firstName}},", font: "body" },
      { kind: "text", text: "Thanks for booking with {{property.name}}. Your reservation is confirmed.", font: "body" },
      { kind: "heading", text: "Reservation", level: 2, font: "head" },
      { kind: "text", text: "Reservation #: {{booking.reservationId}}", font: "body" },
      { kind: "text", text: "Room: {{booking.roomName}}", font: "body" },
      { kind: "text", text: "Rate: {{booking.rateName}}", font: "body" },
      { kind: "text", text: "Check-in: {{booking.checkIn}}", font: "body" },
      { kind: "text", text: "Check-out: {{booking.checkOut}}", font: "body" },
      { kind: "text", text: "Guests: {{booking.adults}}", font: "body" },
      { kind: "text", text: "Total: {{booking.grandTotal}}", font: "body" },
      { kind: "divider", font: "body" },
      {
        kind: "text",
        text: "Need to make a change? Reply to this email and we'll help. We look forward to welcoming you to {{property.name}}.",
        font: "body",
      },
    ],
  });

  // ─── 2. Booking cancellation ─────────────────────────────────────────
  const cancellationHtml = htmlShell({
    fonts,
    preheader: "Your booking at {{property.name}} has been cancelled",
    inner: `
<h1>Booking cancelled</h1>
<p>Hi {{guest.firstName}},</p>
<p>Your booking at {{property.name}} has been cancelled. The reservation number was {{booking.reservationId}}.</p>
<p>If a refund applies, it will appear on your statement within 5–10 business days. If you didn't request this cancellation, reply to this email immediately.</p>
<hr class="hr">
<p>Thanks, {{property.name}}</p>
`,
  });
  const cancellationDesign = buildDesign({
    fonts,
    preheader: "Your booking at {{property.name}} has been cancelled",
    blocks: [
      { kind: "heading", text: "Booking cancelled", level: 1, font: "head" },
      { kind: "text", text: "Hi {{guest.firstName}},", font: "body" },
      {
        kind: "text",
        text: "Your booking at {{property.name}} has been cancelled. The reservation number was {{booking.reservationId}}.",
        font: "body",
      },
      {
        kind: "text",
        text: "If a refund applies, it will appear on your statement within 5–10 business days. If you didn't request this cancellation, reply to this email immediately.",
        font: "body",
      },
      { kind: "divider", font: "body" },
      { kind: "text", text: "Thanks, {{property.name}}", font: "body" },
    ],
  });

  // ─── 3. Pre-arrival (T-3 days) ───────────────────────────────────────
  const preArrivalHtml = htmlShell({
    fonts,
    preheader: "Three days to go until your stay at {{property.name}}",
    inner: `
<h1>Three days to go</h1>
<p>Hi {{guest.firstName}},</p>
<p>We're getting your room ready for {{booking.checkIn}}. Here's everything you might need before you arrive.</p>
<h2>Getting here</h2>
<p>We're at {{property.address}}.</p>
<h2>Your booking</h2>
${row("Reservation #", "{{booking.reservationId}}")}
${row("Room", "{{booking.roomName}}")}
${row("Check-in", "{{booking.checkIn}}")}
${row("Check-out", "{{booking.checkOut}}")}
<p>If anything has changed or you need to add a request, reply to this email.</p>
`,
  });
  const preArrivalDesign = buildDesign({
    fonts,
    preheader: "Three days to go until your stay at {{property.name}}",
    blocks: [
      { kind: "heading", text: "Three days to go", level: 1, font: "head" },
      { kind: "text", text: "Hi {{guest.firstName}},", font: "body" },
      {
        kind: "text",
        text: "We're getting your room ready for {{booking.checkIn}}. Here's everything you might need before you arrive.",
        font: "body",
      },
      { kind: "heading", text: "Getting here", level: 2, font: "head" },
      { kind: "text", text: "We're at {{property.address}}.", font: "body" },
      { kind: "heading", text: "Your booking", level: 2, font: "head" },
      { kind: "text", text: "Reservation #: {{booking.reservationId}}", font: "body" },
      { kind: "text", text: "Room: {{booking.roomName}}", font: "body" },
      { kind: "text", text: "Check-in: {{booking.checkIn}}", font: "body" },
      { kind: "text", text: "Check-out: {{booking.checkOut}}", font: "body" },
      {
        kind: "text",
        text: "If anything has changed or you need to add a request, reply to this email.",
        font: "body",
      },
    ],
  });

  // ─── 4. Welcome on arrival ───────────────────────────────────────────
  const welcomeHtml = htmlShell({
    fonts,
    preheader: "Welcome to {{property.name}}",
    inner: `
<h1>Welcome</h1>
<p>Hi {{guest.firstName}},</p>
<p>Welcome to {{property.name}}. We hope your room is exactly what you wanted. A few practical things while you settle in.</p>
<h2>During your stay</h2>
<p>Wifi is on every floor — the name and password are on the welcome card in your room. Breakfast is served 7–10 AM in the breakfast room.</p>
<p>If you need anything, call {{property.phone}} or reply to this email. Reception is open 7 AM – 11 PM.</p>
`,
  });
  const welcomeDesign = buildDesign({
    fonts,
    preheader: "Welcome to {{property.name}}",
    blocks: [
      { kind: "heading", text: "Welcome", level: 1, font: "head" },
      { kind: "text", text: "Hi {{guest.firstName}},", font: "body" },
      {
        kind: "text",
        text: "Welcome to {{property.name}}. We hope your room is exactly what you wanted. A few practical things while you settle in.",
        font: "body",
      },
      { kind: "heading", text: "During your stay", level: 2, font: "head" },
      {
        kind: "text",
        text: "Wifi is on every floor — the name and password are on the welcome card in your room. Breakfast is served 7–10 AM in the breakfast room.",
        font: "body",
      },
      {
        kind: "text",
        text: "If you need anything, call {{property.phone}} or reply to this email. Reception is open 7 AM – 11 PM.",
        font: "body",
      },
    ],
  });

  // ─── 5. Post-stay review ────────────────────────────────────────────
  const postStayHtml = htmlShell({
    fonts,
    preheader: "How was your stay at {{property.name}}?",
    inner: `
<h1>Thank you for staying</h1>
<p>Hi {{guest.firstName}},</p>
<p>Thank you for staying with us at {{property.name}}. We hope you had a comfortable time.</p>
<p>If you have a moment, a short review really helps us — and helps the next guest decide. We read every one.</p>
<p><a class="btn" href="{{links.review}}">Leave a review</a></p>
<p>If something wasn't right, we'd rather hear it directly. Reply to this email and we'll make it right.</p>
`,
  });
  const postStayDesign = buildDesign({
    fonts,
    preheader: "How was your stay at {{property.name}}?",
    blocks: [
      { kind: "heading", text: "Thank you for staying", level: 1, font: "head" },
      { kind: "text", text: "Hi {{guest.firstName}},", font: "body" },
      {
        kind: "text",
        text: "Thank you for staying with us at {{property.name}}. We hope you had a comfortable time.",
        font: "body",
      },
      {
        kind: "text",
        text: "If you have a moment, a short review really helps us — and helps the next guest decide. We read every one.",
        font: "body",
      },
      { kind: "button", text: "Leave a review", href: "{{links.review}}", font: "body" },
      {
        kind: "text",
        text: "If something wasn't right, we'd rather hear it directly. Reply to this email and we'll make it right.",
        font: "body",
      },
    ],
  });

  return [
    {
      key: "confirmation",
      name: "Booking confirmation",
      subject: "Booking confirmed at {{property.name}} — {{booking.reservationId}}",
      isTransactional: true,
      status: "active",
      design: confirmationDesign,
      html: confirmationHtml,
    },
    {
      key: "cancellation",
      name: "Booking cancellation",
      subject: "Booking cancelled — {{booking.reservationId}}",
      isTransactional: true,
      status: "active",
      design: cancellationDesign,
      html: cancellationHtml,
    },
    {
      key: "pre_arrival",
      name: "Pre-arrival",
      subject: "See you in 3 days at {{property.name}}, {{guest.firstName}}",
      isTransactional: false,
      status: "active",
      design: preArrivalDesign,
      html: preArrivalHtml,
      defaultSchedule: {
        enabled: true,
        trigger: "arrival",
        offsetDays: -3,
        timeOfDay: "09:00",
        audience: "all",
      },
    },
    {
      key: "welcome",
      name: "Welcome on arrival",
      subject: "Welcome to {{property.name}}",
      isTransactional: false,
      status: "active",
      design: welcomeDesign,
      html: welcomeHtml,
      defaultSchedule: {
        enabled: true,
        trigger: "arrival",
        offsetDays: 0,
        timeOfDay: "08:00",
        audience: "all",
      },
    },
    {
      key: "post_stay",
      name: "Post-stay review",
      subject: "How was your stay at {{property.name}}?",
      isTransactional: false,
      status: "draft",
      design: postStayDesign,
      html: postStayHtml,
      defaultSchedule: {
        enabled: false,
        trigger: "checkout",
        offsetDays: 1,
        timeOfDay: "10:00",
        audience: "all",
      },
    },
  ];
}

// Resolver used by send-template.ts when an admin hasn't edited a template
// yet. Without per-property font knowledge we fall back to a safe system stack;
// callers (seed flow, admin UI) should pass the resolved theme fonts instead.
const FALLBACK_FONTS: EmailFontStacks = {
  headingDisplayName: "Inter",
  headingStack: `"Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`,
  bodyDisplayName: "Inter",
  bodyStack: `"Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`,
};

export const DEFAULT_TEMPLATES: DefaultTemplate[] = buildDefaultTemplates(FALLBACK_FONTS);

export function findDefaultTemplate(key: string): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}
