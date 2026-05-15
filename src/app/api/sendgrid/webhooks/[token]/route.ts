import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/db";
import { emailSends } from "@/db/schema";
import { eq } from "drizzle-orm";

// SendGrid Event Webhook receiver.
// Auth: dynamic [token] segment must match SENDGRID_WEBHOOK_TOKEN. Wrong token
// returns 404, same posture as the Cloudbeds webhook.
//
// Body: an array of events. Each event has `event` (delivered, open, bounce…)
// and the customArgs we set at send time — we rely on `send_id` to find the
// email_sends row to update.

interface SendGridEvent {
  email?: string;
  event: string; // processed | delivered | open | click | bounce | dropped | deferred | spamreport | unsubscribe
  timestamp?: number;
  sg_message_id?: string;
  reason?: string;
  send_id?: string;
  property_id?: string;
  template_key?: string;
  booking_id?: string;
}

function eventToStatus(event: string): {
  status: string;
  setAt?: "deliveredAt" | "openedAt" | "bouncedAt";
} | null {
  switch (event) {
    case "processed":
      return { status: "sent" };
    case "delivered":
      return { status: "delivered", setAt: "deliveredAt" };
    case "open":
      return { status: "opened", setAt: "openedAt" };
    case "click":
      return { status: "clicked" };
    case "bounce":
      return { status: "bounced", setAt: "bouncedAt" };
    case "dropped":
      return { status: "dropped", setAt: "bouncedAt" };
    case "deferred":
      return { status: "deferred" };
    default:
      return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const expected = process.env.SENDGRID_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Constant-time compare; mismatch returns 404 so attackers can't probe.
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let events: SendGridEvent[];
  try {
    events = (await req.json()) as SendGridEvent[];
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(events)) {
    return NextResponse.json({ error: "expected_array" }, { status: 400 });
  }

  let updated = 0;
  // Process asynchronously after acking — SendGrid expects 2xx fast.
  void (async () => {
    for (const ev of events) {
      const mapped = eventToStatus(ev.event);
      if (!mapped) continue;

      // Locate the row. Prefer send_id (set by us at send time); fall back to
      // sg_message_id if not present (older sends pre-customArgs).
      let rowId: string | null = null;
      if (ev.send_id) {
        rowId = ev.send_id;
      } else if (ev.sg_message_id) {
        const [row] = await db
          .select({ id: emailSends.id })
          .from(emailSends)
          .where(eq(emailSends.sendgridMessageId, ev.sg_message_id))
          .limit(1);
        if (row) rowId = row.id;
      }
      if (!rowId) continue;

      const at = ev.timestamp ? new Date(ev.timestamp * 1000) : new Date();
      type UpdatePatch = {
        status: string;
        errorMessage: string | null;
        deliveredAt?: Date;
        openedAt?: Date;
        bouncedAt?: Date;
      };
      const patch: UpdatePatch = {
        status: mapped.status,
        errorMessage: ev.reason ?? null,
      };
      if (mapped.setAt === "deliveredAt") patch.deliveredAt = at;
      if (mapped.setAt === "openedAt") patch.openedAt = at;
      if (mapped.setAt === "bouncedAt") patch.bouncedAt = at;
      try {
        await db
          .update(emailSends)
          .set(patch)
          .where(eq(emailSends.id, rowId));
        updated++;
      } catch (e) {
        console.error(`SendGrid event update failed for ${rowId}:`, e);
      }
    }
  })();

  return NextResponse.json({ ok: true, received: events.length });
}
