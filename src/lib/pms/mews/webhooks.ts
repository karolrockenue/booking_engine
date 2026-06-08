// Mews General Webhook handler.
//
// Mews has no "availability changed" event (integration plan §9). The closest
// signals that our cached availability may now be stale are:
//   - ServiceOrderUpdated  → a reservation was created/changed/cancelled
//   - ResourceBlockUpdated → an out-of-order / maintenance block changed
// On either, we re-run the Mews inventory sync for the affected enterprise,
// which re-pulls the legacy services/getAvailability counts. The scheduled poll
// (cron/inventory-sync) remains the real safety net; webhooks just make us
// react faster between polls.
//
// Mews General Webhooks are configured at the INTEGRATION level (one endpoint
// for the whole ClientToken), not per property — so events arrive for any
// enterprise on the integration and carry an EnterpriseId we map back to a
// property. There is no per-property subscription to manage (plan §5/§9).

import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncMewsInventoryForProperty } from "./sync-inventory";

// Event discriminators that should invalidate our cached availability. Matched
// case-insensitively and by prefix so minor Mews naming variants (e.g. a
// trailing qualifier) still count — when in doubt, sync; it's idempotent.
const INVENTORY_INVALIDATING = ["serviceorder", "resourceblock"];

interface MewsWebhookEvent {
  Discriminator?: string;
  Value?: { EnterpriseId?: string } & Record<string, unknown>;
}

export interface MewsWebhookPayload {
  Events?: MewsWebhookEvent[];
}

export interface MewsSyncTargets {
  totalEvents: number;
  relevantEvents: number;
  enterpriseIds: string[]; // distinct, from relevant events only
}

// Pure parser (no I/O) so the event-shape logic is unit-testable without live
// Mews delivery, which the shared demo environment cannot exercise.
export function extractMewsSyncTargets(
  payload: MewsWebhookPayload
): MewsSyncTargets {
  const events = Array.isArray(payload?.Events) ? payload.Events : [];
  const enterpriseIds = new Set<string>();
  let relevant = 0;

  for (const evt of events) {
    const disc = (evt?.Discriminator ?? "").toLowerCase();
    if (!INVENTORY_INVALIDATING.some((k) => disc.startsWith(k))) continue;
    relevant++;
    const entId = evt?.Value?.EnterpriseId;
    if (entId) enterpriseIds.add(entId);
  }

  return {
    totalEvents: events.length,
    relevantEvents: relevant,
    enterpriseIds: [...enterpriseIds],
  };
}

interface MewsCredsShape {
  enterpriseId?: string;
}

export interface MewsWebhookResult {
  totalEvents: number;
  relevantEvents: number;
  syncedProperties: number;
  unmatchedEnterprises: string[];
}

// Resolves the enterprise(s) the webhook touched to our properties and kicks off
// a fire-and-forget re-sync for each. Returns a fast summary; the actual sync
// runs async so the route can ack within Mews's 5s SLA.
export async function handleMewsWebhookEvents(
  payload: MewsWebhookPayload
): Promise<MewsWebhookResult> {
  const { totalEvents, relevantEvents, enterpriseIds } =
    extractMewsSyncTargets(payload);

  if (enterpriseIds.length === 0) {
    return {
      totalEvents,
      relevantEvents,
      syncedProperties: 0,
      unmatchedEnterprises: [],
    };
  }

  // Map enterpriseId → propertyId. enterpriseId is stored in plaintext inside
  // pms_credentials (only the AccessToken is encrypted), so no decrypt needed.
  const mewsProps = await db
    .select({
      id: properties.id,
      pmsCredentials: properties.pmsCredentials,
    })
    .from(properties)
    .where(eq(properties.pmsType, "mews"));

  const byEnterprise = new Map<string, string>();
  for (const p of mewsProps) {
    const entId = (p.pmsCredentials as MewsCredsShape | null)?.enterpriseId;
    if (entId) byEnterprise.set(entId, p.id);
  }

  let synced = 0;
  const unmatched: string[] = [];
  for (const entId of enterpriseIds) {
    const propertyId = byEnterprise.get(entId);
    if (!propertyId) {
      unmatched.push(entId);
      continue;
    }
    synced++;
    // Fire-and-forget: don't block the webhook ack on the sync (Mews 5s SLA).
    void syncMewsInventoryForProperty(propertyId).catch((e) => {
      console.error(
        `[Mews webhook] sync for ${propertyId} (enterprise ${entId}) failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    });
  }

  if (unmatched.length > 0) {
    console.warn(
      `[Mews webhook] no connected property for enterprise(s): ${unmatched.join(", ")}`
    );
  }

  return {
    totalEvents,
    relevantEvents,
    syncedProperties: synced,
    unmatchedEnterprises: unmatched,
  };
}
