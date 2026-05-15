/**
 * Render all 5 default email templates with sample vars to verify the Unlayer
 * renderer + variable substitution work end-to-end. Read-only — no DB, no send.
 *
 * Run with:
 *   npx tsx src/scripts/render-templates-smoke.ts
 */

import { DEFAULT_TEMPLATES, buildDefaultTemplates } from "../lib/email/template-defaults";
import { PORTICO_FONTS } from "../lib/email/fonts";
import { renderUnlayerTemplate } from "../lib/email/unlayer-renderer";
import { buildVarMap, substitute } from "../lib/email/variables";

function main() {
  const vars = buildVarMap({
    guest: { firstName: "Karol", lastName: "Marcu", email: "karol@example.com" },
    booking: {
      reservationId: "CB-29481",
      orderId: "8c4f",
      checkIn: "2026-05-15",
      checkOut: "2026-05-17",
      nights: 2,
      adults: 2,
      children: 0,
      roomName: "Double Room",
      rateName: "Standard",
      rateType: "flex",
      currency: "GBP",
      symbol: "£",
      grandTotal: 320,
      roomTotal: 320,
      extrasTotal: 0,
    },
    property: {
      name: "The Portico Hotel",
      address: "32 Sussex Gardens, Paddington, London W2 1UJ",
      phone: "+44 20 7402 0190",
      email: "stay@theporticohotel.com",
    },
    links: { cancel: "https://example.com/cancel/abc", maps: "" },
  });

  // Render with the Portico brand fonts so we can confirm Cormorant Garamond +
  // Inter actually make it into the output HTML.
  const portico = buildDefaultTemplates(PORTICO_FONTS);

  for (const t of portico) {
    const html = renderUnlayerTemplate({ html: t.html, vars });
    const subject = substitute(t.subject, vars);
    const headingCount = (html.match(/Cormorant Garamond/g) ?? []).length;
    const bodyCount = (html.match(/Inter/g) ?? []).length;
    console.log(`---- ${t.key} (${html.length} bytes) ----`);
    console.log(`subject:        ${subject}`);
    console.log(`Cormorant refs: ${headingCount}`);
    console.log(`Inter refs:     ${bodyCount}`);
    console.log(html.slice(0, 240).replace(/\s+/g, " "));
    console.log();
  }

  console.log(`Rendered ${portico.length} default templates · fallback set: ${DEFAULT_TEMPLATES.length}`);
}

main();
