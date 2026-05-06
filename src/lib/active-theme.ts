// Active "skin" for this Railway deployment. Selected at startup via the
// THEME env var. Same backend, same data — different page components per theme.
//
// In development a cookie set by /dev/themes can override the env var so you
// can flip between designs without restarting the dev server. The cookie has
// no effect in production (env var is the only source of truth on Railway).
//
// Adding a new theme:
//   1. Append the slug to PORTICO_THEMES (or extend the union if not Portico).
//   2. Wire its components in src/themes/<slug>/.
//   3. Add it to VALID_THEMES below so the dev cookie can target it.
//   4. Spin up a new Railway service with THEME=<slug>.

import { cookies } from "next/headers";

export const PORTICO_THEMES = ["portico-ivory"] as const;
export type PorticoTheme = (typeof PORTICO_THEMES)[number];
export type ActiveTheme = "default" | PorticoTheme;

export const DEV_THEME_COOKIE = "dev-theme";

const VALID_THEMES = new Set<ActiveTheme>(["default", "portico-ivory"]);

export async function getActiveTheme(): Promise<ActiveTheme> {
  // Dev-only override (cookie set by /dev/themes).
  if (process.env.NODE_ENV !== "production") {
    try {
      const jar = await cookies();
      const v = jar.get(DEV_THEME_COOKIE)?.value?.toLowerCase().trim();
      if (v && VALID_THEMES.has(v as ActiveTheme)) return v as ActiveTheme;
    } catch {
      // Outside a request scope (e.g. during build prerender). Fall through.
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
