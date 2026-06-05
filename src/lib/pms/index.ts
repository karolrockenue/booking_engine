// PMS adapter factory. Resolves the right adapter for a property. All PMS
// access goes through this — call sites never import a concrete PMS lib.

import type { PmsAdapter, PmsProperty } from "./types";
import { CloudbedsAdapter } from "./cloudbeds-adapter";

export * from "./types";

export function getPmsAdapter(property: PmsProperty): PmsAdapter {
  if (property.pmsType === "mews") {
    // MewsAdapter lands in Phase 3 (reads) / Phase 4 (writes). A property can be
    // connected to Mews (Phase 2) before then; nothing constructs an adapter for
    // it yet (no synced inventory, no bookings), so fail loud if something does.
    throw new Error("Mews adapter not yet implemented (Phase 3/4)");
  }
  return new CloudbedsAdapter(property);
}
