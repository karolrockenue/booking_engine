import { db } from "@/db";
import {
  properties,
  cloudbedsWebhookSubscriptions,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { getValidAccessToken } from "./client";

// Events we subscribe to per property. Matches what the webhook handler at
// /api/cloudbeds/webhooks treats as inventory-invalidating, plus a couple of
// reservation-shape events we'll want for booking sync later.
const SUBSCRIBED_EVENTS: Array<{ object: string; action: string }> = [
  { object: "reservation", action: "created" },
  { object: "reservation", action: "status_changed" },
  { object: "reservation", action: "dates_changed" },
  { object: "reservation", action: "accommodation_status_changed" },
  { object: "reservation", action: "accommodation_type_changed" },
  { object: "reservation", action: "deleted" },
  { object: "availability", action: "closeout_changed" },
  { object: "api_queue_task", action: "rate_status_changed" },
  { object: "roomblock", action: "created" },
  { object: "roomblock", action: "removed" },
];

const POST_WEBHOOK_URL = "https://hotels.cloudbeds.com/api/v1.3/postWebhook";
const DELETE_WEBHOOK_URL =
  "https://hotels.cloudbeds.com/api/v1.3/deleteWebhook";

interface PostWebhookResponse {
  success: boolean;
  data?: { id?: string; subscriptionID?: string };
  message?: string;
}

interface DeleteWebhookResponse {
  success: boolean;
  message?: string;
}

function resolveEndpointUrl(): string {
  const explicit = process.env.CLOUDBEDS_WEBHOOK_URL;
  if (explicit) return explicit;
  // Fall back to the OAuth callback's origin — same domain in practice.
  const redirectUri = process.env.CLOUDBEDS_REDIRECT_URI;
  if (redirectUri) {
    return `${new URL(redirectUri).origin}/api/cloudbeds/webhooks`;
  }
  throw new Error(
    "Webhook endpoint URL not configured: set CLOUDBEDS_WEBHOOK_URL or CLOUDBEDS_REDIRECT_URI"
  );
}

export interface SubscribeResult {
  propertyId: string;
  cloudbedsPropertyId: string;
  endpointUrl: string;
  created: number;
  alreadySubscribed: number;
  failed: Array<{ object: string; action: string; error: string }>;
}

export async function subscribeWebhooksForProperty(
  propertyId: string
): Promise<SubscribeResult> {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!property) throw new Error(`Property ${propertyId} not found`);
  if (!property.cloudbedsPropertyId) {
    throw new Error(
      `Property ${propertyId} has no cloudbedsPropertyId — connect via OAuth first`
    );
  }

  const endpointUrl = resolveEndpointUrl();
  const cloudbedsPropertyId = property.cloudbedsPropertyId;

  // Pull existing subscriptions so we don't double-subscribe (Cloudbeds will
  // happily create duplicates and we'd then receive every event N times).
  const existing = await db
    .select()
    .from(cloudbedsWebhookSubscriptions)
    .where(eq(cloudbedsWebhookSubscriptions.propertyId, propertyId));
  const existingKeys = new Set(
    existing.map((s) => `${s.object}/${s.action}`)
  );

  const result: SubscribeResult = {
    propertyId,
    cloudbedsPropertyId,
    endpointUrl,
    created: 0,
    alreadySubscribed: 0,
    failed: [],
  };

  for (const evt of SUBSCRIBED_EVENTS) {
    const key = `${evt.object}/${evt.action}`;
    if (existingKeys.has(key)) {
      result.alreadySubscribed++;
      continue;
    }

    try {
      const token = await getValidAccessToken(propertyId);
      const url = new URL(POST_WEBHOOK_URL);
      url.searchParams.set("propertyID", cloudbedsPropertyId);

      const body = new URLSearchParams({
        endpointUrl,
        object: evt.object,
        action: evt.action,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });

      const payload = (await res.json()) as PostWebhookResponse;
      if (!res.ok || !payload.success) {
        result.failed.push({
          object: evt.object,
          action: evt.action,
          error: `${res.status} ${payload.message ?? "unknown"}`,
        });
        continue;
      }

      const subscriptionId = payload.data?.id ?? payload.data?.subscriptionID;
      if (!subscriptionId) {
        result.failed.push({
          object: evt.object,
          action: evt.action,
          error: "postWebhook returned no subscription id",
        });
        continue;
      }

      await db.insert(cloudbedsWebhookSubscriptions).values({
        propertyId,
        cloudbedsSubscriptionId: subscriptionId,
        object: evt.object,
        action: evt.action,
        endpointUrl,
      });
      result.created++;
    } catch (e) {
      result.failed.push({
        object: evt.object,
        action: evt.action,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}

export interface UnsubscribeResult {
  propertyId: string;
  deleted: number;
  failed: Array<{ subscriptionId: string; error: string }>;
}

export async function unsubscribeWebhooksForProperty(
  propertyId: string
): Promise<UnsubscribeResult> {
  const subs = await db
    .select()
    .from(cloudbedsWebhookSubscriptions)
    .where(eq(cloudbedsWebhookSubscriptions.propertyId, propertyId));

  const result: UnsubscribeResult = {
    propertyId,
    deleted: 0,
    failed: [],
  };

  const succeededIds: string[] = [];

  for (const sub of subs) {
    try {
      const token = await getValidAccessToken(propertyId);
      const url = new URL(DELETE_WEBHOOK_URL);

      const body = new URLSearchParams({
        subscriptionID: sub.cloudbedsSubscriptionId,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });
      const payload = (await res.json()) as DeleteWebhookResponse;

      if (!res.ok || !payload.success) {
        result.failed.push({
          subscriptionId: sub.cloudbedsSubscriptionId,
          error: `${res.status} ${payload.message ?? "unknown"}`,
        });
        continue;
      }
      succeededIds.push(sub.id);
      result.deleted++;
    } catch (e) {
      result.failed.push({
        subscriptionId: sub.cloudbedsSubscriptionId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (succeededIds.length > 0) {
    await db
      .delete(cloudbedsWebhookSubscriptions)
      .where(inArray(cloudbedsWebhookSubscriptions.id, succeededIds));
  }

  return result;
}
