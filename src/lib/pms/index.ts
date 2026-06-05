// PMS adapter factory. Resolves the right adapter for a property. All PMS
// access goes through this — call sites never import a concrete PMS lib.

import type { PmsAdapter, PmsProperty } from "./types";
import { CloudbedsAdapter } from "./cloudbeds-adapter";
import { MewsAdapter } from "./mews-adapter";

export * from "./types";

export function getPmsAdapter(property: PmsProperty): PmsAdapter {
  if (property.pmsType === "mews") {
    // Read path live (Phase 3); write path + webhooks throw until Phase 4/5.
    return new MewsAdapter(property);
  }
  return new CloudbedsAdapter(property);
}
