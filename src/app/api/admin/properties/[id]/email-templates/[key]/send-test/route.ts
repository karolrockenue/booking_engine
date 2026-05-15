import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { properties as propertiesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { renderUnlayerTemplate, renderUnlayerPlainText } from "@/lib/email/unlayer-renderer";
import { sendEmail } from "@/lib/email/sendgrid";
import { buildVarMap, substitute } from "@/lib/email/variables";
import { getPropertyContent } from "@/lib/get-property";

// Send a one-off test of the template draft to a single address. Uses sample
// vars (not a real booking) so the admin can see roughly what guests get.
// Body shape from composer: { to, subject, html } — the html is freshly
// exported by Unlayer at click time, so we don't need the design here.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id, key } = await params;
  const body = await req.json();

  if (!body.to || !body.subject || !body.html) {
    return NextResponse.json(
      { error: "to, subject, html are required" },
      { status: 400 }
    );
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, id))
    .limit(1);
  if (!property) {
    return NextResponse.json({ error: "property_not_found" }, { status: 404 });
  }
  const content = await getPropertyContent(id);

  const vars = buildVarMap({
    guest: { firstName: "Karol", lastName: "Marcu", email: body.to },
    booking: {
      reservationId: "CB-29481",
      orderId: "test-order",
      checkIn: "2026-05-15",
      checkOut: "2026-05-17",
      nights: 2,
      adults: 2,
      children: 0,
      roomName: "Double Room",
      rateName: "Standard",
      rateType: "flex",
      currency: property.currency ?? "GBP",
      symbol: property.currency === "EUR" ? "€" : property.currency === "USD" ? "$" : "£",
      grandTotal: 320,
      roomTotal: 320,
      extrasTotal: 0,
    },
    property: {
      name: property.name,
      address: content.contact.addressLines.join(", "),
      phone: content.contact.reservationsPhone,
      email: content.contact.reservationsEmail,
    },
    links: { cancel: "https://example.com/cancel/test" },
  });

  const subject = substitute(body.subject, vars);
  const html = renderUnlayerTemplate({ html: body.html, vars });
  const text = renderUnlayerPlainText({ html: body.html, vars });

  await sendEmail({
    to: body.to,
    subject: `[TEST · ${key}] ${subject}`,
    html,
    text,
    from: property.emailFromAddress ?? undefined,
    fromName: property.emailFromName ?? property.name,
    replyTo: property.emailReplyTo ?? property.emailFromAddress ?? undefined,
    customArgs: { test_send: "1", property_id: id, template_key: key },
  });

  return NextResponse.json({ ok: true });
}
