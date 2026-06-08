// PMS-agnostic batch inventory sync. Iterates every property and dispatches the
// sync through that property's adapter (Cloudbeds or Mews), so the scheduled
// poll keeps both PMSs' cached availability fresh. For Mews this poll IS the
// no-oversell safety net the integration plan calls for (§9): there is no
// "availability changed" webhook, so re-running syncMewsInventoryForProperty on
// a schedule is the only guarantee the cache stays correct.

import { db } from "@/db";
import { properties } from "@/db/schema";
import { getPmsAdapter } from "./index";
import type { PmsSyncResult } from "./types";

// Errors that mean "this property simply isn't connected to its PMS yet" — not a
// real failure, just skip it quietly (matches the old Cloudbeds-only batch).
// Cloudbeds: missing property id / tokens. Mews: missing AccessToken / serviceId
// / not a Mews property.
const NOT_CONNECTED =
  /has no cloudbedsPropertyId|has no Cloudbeds tokens|is not connected to Mews|has no Mews AccessToken|has no Mews serviceId/;

export interface BatchSyncResult {
  results: PmsSyncResult[];
  skipped: number;
}

export async function syncInventoryForAllProperties(
  days = 90
): Promise<BatchSyncResult> {
  const all = await db
    .select({
      id: properties.id,
      name: properties.name,
      cloudbedsPropertyId: properties.cloudbedsPropertyId,
      pmsType: properties.pmsType,
    })
    .from(properties);

  const results: PmsSyncResult[] = [];
  let skipped = 0;

  for (const p of all) {
    try {
      const res = await getPmsAdapter(p).syncInventory(days);
      results.push(res);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (NOT_CONNECTED.test(message)) {
        skipped++;
        continue;
      }
      // One bad property must not kill the batch — log and carry on.
      console.error(
        `[pms-sync-all] syncInventory(${p.id} ${p.pmsType ?? "cloudbeds"}) failed: ${message}`
      );
    }
  }

  return { results, skipped };
}
