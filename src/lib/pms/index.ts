// PMS adapter factory. Resolves the right adapter for a property. All PMS
// access goes through this — call sites never import a concrete PMS lib.

import type { PmsAdapter, PmsProperty } from "./types";
import { CloudbedsAdapter } from "./cloudbeds-adapter";

export * from "./types";

export function getPmsAdapter(property: PmsProperty): PmsAdapter {
  // Phase 2 adds: if (property.pmsType === "mews") return new MewsAdapter(property);
  // Until then (and for every existing property) this is Cloudbeds.
  return new CloudbedsAdapter(property);
}
