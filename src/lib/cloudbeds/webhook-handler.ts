import { NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncInventoryForProperty } from "./sync-inventory";

// Cloudbeds webhook event names that should invalidate our inventory cache.
// Cross-checked against the official events reference. When in doubt, sync —
// it's cheap and idempotent.
const INVENTORY_INVALIDATING_EVENTS = new Set([
  "reservation/created",
  "reservation/status_changed",
  "reservation/dates_changed",
  "reservation/accommodation_status_changed",
  "reservation/accommodation_type_changed",
  "reservation/deleted",
  "availability/closeout_changed",
  "api_queue_task/rate_status_changed",
  "roomblock/created",
  "roomblock/removed",
]);

export interface WebhookPayload {
  event?: string;
  propertyID?: string | number;
  propertyId?: string | number;
  data?: unknown;
}

export async function handleCloudbedsWebhook(
  payload: WebhookPayload
): Promise<NextResponse> {
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

  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.cloudbedsPropertyId, cloudbedsPropertyId))
    .limit(1);

  if (!property) {
    console.warn(
      `Webhook for unknown cloudbedsPropertyId=${cloudbedsPropertyId} event=${event}`
    );
    return NextResponse.json({ ok: true, unknown: true });
  }

  // Fire-and-forget: don't block the webhook ack on the sync. Cloudbeds
  // expects fast 2xx responses; long syncs can time out.
  void syncInventoryForProperty(property.id).catch((e) => {
    console.error(
      `Webhook-triggered sync for ${property.id} (${event}) failed: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  });

  return NextResponse.json({ ok: true, event, syncTriggered: true });
}
