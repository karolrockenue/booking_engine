// Per-template content schema. Each template declares which photo slots and
// content blocks it renders, so the admin (Media / Content / Design tabs) can
// show template-specific guidance, required-fill counts, and fallback hints
// instead of generic "Hero / Gallery / …" labels.
//
// Adding a new template: write `src/themes/<slug>/schema.ts` exporting a
// `TemplateSchema`, then register it in `SCHEMAS` below.

import { porticoSchema } from "@/themes/portico/schema";
import { streetSchema } from "@/themes/street/schema";

export type PhotoSlotKey = "hero" | "gallery" | "neighbourhood" | "room";
export type ContentBlockKey =
  | "hero"
  | "neighbourhood"
  | "goodToKnow"
  | "contact"
  | "footer";

export interface PhotoSlotSpec {
  label: string; // user-facing name shown in the Media tab
  hint?: string; // short clarifier shown next to the label
  required: boolean;
  min?: number; // ≥1 = "needs N photos to look complete"
  fallback?: string; // human description of what shows when empty
  perRoomType?: boolean; // bucket is per-room-type rather than a single list
}

export interface ContentBlockSpec {
  label: string;
  hint?: string;
}

export interface TemplateSchema {
  photos: Partial<Record<PhotoSlotKey, PhotoSlotSpec>>;
  content: Partial<Record<ContentBlockKey, ContentBlockSpec>>;
  // True if the template doesn't read uploaded photos/content blocks at all —
  // surfaces an honest banner in the admin so users know edits won't take effect.
  ignoresUploads?: boolean;
}

// The legacy non-themed flow (src/app/[property]/home-client.tsx) hardcodes
// its imagery and copy. Until that's refactored to consume getPropertyPhotos /
// getPropertyContent, the admin should flag this honestly.
const DEFAULT_SCHEMA: TemplateSchema = {
  photos: {},
  content: {},
  ignoresUploads: true,
};

const SCHEMAS: Record<string, TemplateSchema> = {
  default: DEFAULT_SCHEMA,
  "portico-ivory": porticoSchema,
  "street-ivory": streetSchema,
};

export function getTemplateSchema(slug: string | null | undefined): TemplateSchema {
  if (!slug) return DEFAULT_SCHEMA;
  return SCHEMAS[slug] ?? DEFAULT_SCHEMA;
}

// Compute readiness for a single photo slot.
//   ok       = enough photos to look complete (required + min met, or optional)
//   needed   = remaining count to reach `min` (0 if already met or no min)
//   total    = current count
export interface SlotReadiness {
  ok: boolean;
  needed: number;
  total: number;
}

export function readinessFor(
  spec: PhotoSlotSpec | undefined,
  count: number
): SlotReadiness {
  if (!spec) return { ok: true, needed: 0, total: count };
  const min = spec.min ?? (spec.required ? 1 : 0);
  const needed = Math.max(0, min - count);
  return { ok: needed === 0, needed, total: count };
}
