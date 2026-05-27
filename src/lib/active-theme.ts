// Which template ("skin") renders for a given hotel. The source of truth is
// the per-property `template_slug` column on `properties`. Templates live in
// src/themes/<slug>/ — code-only, authored by the platform team.
//
// Resolution order (per request):
//   1. Dev cookie override (set by /dev/themes) — non-prod only, lets you
//      preview any template on any hotel without touching the DB.
//   2. property.templateSlug — the assigned template for that hotel.
//   3. THEME env var — legacy deployment-wide fallback (kept so existing
//      Railway services don't break mid-rollout; will be removed once every
//      hotel has a template_slug set).
//   4. "default".
//
// Adding a new template:
//   1. Append the slug to PORTICO_THEMES (or extend the union if not Portico).
//   2. Wire its components in src/themes/<slug>/.
//   3. Add it to VALID_THEMES below.
//   4. Set property.template_slug = <slug> for any hotel that should use it.

import { cookies } from "next/headers";

export const PORTICO_THEMES = ["portico-ivory"] as const;
export type PorticoTheme = (typeof PORTICO_THEMES)[number];
export type ActiveTheme = "default" | PorticoTheme;

export const DEV_THEME_COOKIE = "dev-theme";

const VALID_THEMES = new Set<ActiveTheme>(["default", "portico-ivory"]);

// Per-property resolver. Pass the property's `template_slug` (from the DB)
// and this returns the template to render for the current request.
export async function getPropertyTheme(
  propertyTemplateSlug: string | null | undefined
): Promise<ActiveTheme> {
  // 1. Dev cookie override (non-prod only).
  if (process.env.NODE_ENV !== "production") {
    try {
      const jar = await cookies();
      const v = jar.get(DEV_THEME_COOKIE)?.value?.toLowerCase().trim();
      if (v && VALID_THEMES.has(v as ActiveTheme)) return v as ActiveTheme;
    } catch {
      // Outside a request scope (e.g. during build prerender). Fall through.
    }
  }

  // 2. Per-property setting.
  const slug = propertyTemplateSlug?.toLowerCase().trim();
  if (slug && VALID_THEMES.has(slug as ActiveTheme)) return slug as ActiveTheme;

  // 3. Legacy env var fallback.
  const raw = process.env.THEME?.toLowerCase().trim();
  if (raw === "portico-ivory") return raw;

  // 4. Default.
  return "default";
}

// Deployment-wide resolver — used only by /dev/themes (which previews the
// env-var / cookie state without a property in scope). Real pages should
// call getPropertyTheme(property.templateSlug) instead.
export async function getActiveTheme(): Promise<ActiveTheme> {
  if (process.env.NODE_ENV !== "production") {
    try {
      const jar = await cookies();
      const v = jar.get(DEV_THEME_COOKIE)?.value?.toLowerCase().trim();
      if (v && VALID_THEMES.has(v as ActiveTheme)) return v as ActiveTheme;
    } catch {
      // Outside a request scope — fall through.
    }
  }
  const raw = process.env.THEME?.toLowerCase().trim();
  if (raw === "portico-ivory") return raw;
  return "default";
}

export function isPortico(theme: ActiveTheme): theme is PorticoTheme {
  return theme === "portico-ivory";
}

export function isValidTheme(s: string): s is ActiveTheme {
  return VALID_THEMES.has(s as ActiveTheme);
}
