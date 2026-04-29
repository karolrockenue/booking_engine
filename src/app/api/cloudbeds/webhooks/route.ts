import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncInventoryForProperty } from "@/lib/cloudbeds/sync-inventory";

// Cloudbeds webhook event names that should invalidate our inventory cache.
// Inferred from the public docs (34 events total). When in doubt, sync — it's
// cheap and idempotent.
const INVENTORY_INVALIDATING_EVENTS = new Set([
  "reservation/created",
  "reservation/status_changed",
  "reservation/dates_changed",
  "reservation/accommodation_status_changed",
  "reservation/deleted",
  "availability/closeout_changed",
  "rate/changed",
]);

interface WebhookPayload {
  event?: string;
  propertyID?: string | number;
  propertyId?: string | number;
  data?: unknown;
}

// Signature verification path lives behind a TODO until Manuel confirms the
// header name + algorithm Cloudbeds uses. Until then this endpoint must live
// on a hard-to-guess path (see WEBHOOK_PATH env var) before going to prod.

export async function POST(req: NextRequest) {
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const event = payload.event ?? "";
  const cloudbedsPropertyId = String(
    payload.propertyID ?? payload.propertyId ?? ""
  );

  if (!event || !cloudbedsPropertyId) {
    return NextResponse.json(
      { error: "missing event or propertyID" },
      { status: 400 }
    );
  }

  if (!INVENTORY_INVALIDATING_EVENTS.has(event)) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  // Find our internal property by cloudbedsPropertyId.
  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.cloudbedsPropertyId, cloudbedsPropertyId))
    .limit(1);

  if (!property) {
    // Unknown property — ack so Cloudbeds doesn't keep retrying, but log.
    console.warn(
      `Webhook for unknown cloudbedsPropertyId=${cloudbedsPropertyId} event=${event}`
    );
    return NextResponse.json({ ok: true, unknown: true });
  }

  // Fire-and-forget: don't block the webhook ack on the sync. Cloudbeds
  // expects fast 2xx responses; long syncs can time out.
  void syncInventoryForProperty(property.id).catch((e) => {
    console.error(
      `Webhook-triggered sync for ${property.id} (${event}) failed: ${e instanceof Error ? e.message : String(e)}`
    );
  });

  return NextResponse.json({ ok: true, event, syncTriggered: true });
}
