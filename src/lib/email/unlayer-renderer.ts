import type { EmailVarMap } from "./variables";
import { substitute } from "./variables";

// Render an Unlayer-produced template by substituting {{var}} tokens into the
// pre-rendered HTML stored alongside the design JSON. The actual HTML is built
// in the browser (Unlayer's editor calls exportHtml client-side) and saved on
// the row — we never need to run Unlayer server-side.

export interface RenderTemplateArgs {
  html: string;
  vars: EmailVarMap;
  preview?: string;
}

export function renderUnlayerTemplate(args: RenderTemplateArgs): string {
  let out = substitute(args.html, args.vars);
  if (args.preview) {
    // Insert preview text just after <body> if not already present. Unlayer's
    // export does not add a preheader by default — this is the minimal hook.
    const preheader = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${args.preview}</div>`;
    out = out.replace(/<body([^>]*)>/i, (match) => `${match}${preheader}`);
  }
  return out;
}

// Cheap plain-text fallback. Strips tags + collapses whitespace. Real plain text
// can be produced via unlayer.exportPlainText() in the composer and stored
// alongside htmlCached, but for v1 this is sufficient and never blocks a send.
export function renderUnlayerPlainText(args: RenderTemplateArgs): string {
  const substituted = substitute(args.html, args.vars);
  return substituted
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
