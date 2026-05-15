import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { findDefaultTemplate } from "@/lib/email/template-defaults";
import { renderUnlayerTemplate } from "@/lib/email/unlayer-renderer";
import { buildVarMap } from "@/lib/email/variables";

// Sample variables for live admin preview. Real sends fill these from the
// booking row at dispatch time (see send-template.ts).
const SAMPLE_VARS = buildVarMap({
  guest: { firstName: "Karol", lastName: "Marcu", email: "karol@example.com" },
  booking: {
    reservationId: "CB-29481",
    orderId: "8c4f-…",
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
  links: {
    cancel: "https://example.com/cancel/…",
    maps: "https://maps.google.com/?q=…",
  },
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id, key } = await params;

  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.propertyId, id), eq(emailTemplates.key, key)))
    .limit(1);

  if (row) return NextResponse.json(row);

  // Fall back to default — admin can edit and save as a new row.
  const fallback = findDefaultTemplate(key);
  if (!fallback) {
    return NextResponse.json({ error: "template not found" }, { status: 404 });
  }
  return NextResponse.json({
    propertyId: id,
    key: fallback.key,
    name: fallback.name,
    subject: fallback.subject,
    body: fallback.design,
    bodyFormat: "unlayer",
    htmlCached: fallback.html,
    status: fallback.status,
    isTransactional: fallback.isTransactional,
    isDefault: true,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  const { id, key } = await params;
  const body = await req.json();

  // body shape from composer: { name, subject, design, html, status, isTransactional, updatedBy }
  if (!body.subject || !body.design || !body.html) {
    return NextResponse.json(
      { error: "subject, design and html are required" },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(emailTemplates)
    .values({
      propertyId: id,
      key,
      name: body.name ?? key,
      subject: body.subject,
      body: body.design,
      bodyFormat: "unlayer",
      htmlCached: body.html,
      status: body.status ?? "active",
      isTransactional: body.isTransactional ?? false,
      updatedAt: new Date(),
      updatedBy: body.updatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: [emailTemplates.propertyId, emailTemplates.key],
      set: {
        name: body.name ?? key,
        subject: body.subject,
        body: body.design,
        bodyFormat: "unlayer",
        htmlCached: body.html,
        status: body.status ?? "active",
        updatedAt: new Date(),
        updatedBy: body.updatedBy ?? null,
      },
    })
    .returning();

  return NextResponse.json(row);
}

// Live preview — accepts the composer's freshly-exported HTML and substitutes
// sample variables. With Unlayer the HTML is built client-side by the editor,
// so we don't render here, we just fill in {{var}} tokens.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; key: string }> }
) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  await params;
  const body = await req.json();

  if (!body.html) {
    return NextResponse.json({ error: "html is required" }, { status: 400 });
  }
  try {
    const html = renderUnlayerTemplate({
      html: body.html,
      vars: SAMPLE_VARS,
    });
    return NextResponse.json({ html, sampleVars: SAMPLE_VARS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
