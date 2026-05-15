// Per-property email font stacks. Resolves the active theme's fonts into
// email-safe CSS font-family strings (web font first, then fallbacks for
// Outlook desktop which ignores web fonts).

import type { PropertyTheme } from "@/lib/theme";

export interface EmailFontStacks {
  headingDisplayName: string;
  headingStack: string;
  bodyDisplayName: string;
  bodyStack: string;
}

// Map a font family name to a safe fallback. Used when the active theme's
// typography points at a Google Font we want to back up with an Outlook-safe
// system font.
function fallbackFor(family: string, kind: "serif" | "sans"): string {
  const safeSerif = "Georgia, 'Times New Roman', serif";
  const safeSans = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
  return kind === "serif" ? safeSerif : safeSans;
}

function isSerif(name: string): boolean {
  const n = name.toLowerCase();
  return /(garamond|serif|times|georgia|cormorant|playfair|merriweather|lora)/.test(n);
}

function stackFor(family: string | undefined | null): {
  display: string;
  stack: string;
} {
  const f = (family || "Inter").trim();
  const kind = isSerif(f) ? "serif" : "sans";
  // Strip any trailing fallbacks if the theme already wrote a stack.
  const primary = f.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return {
    display: primary,
    stack: `"${primary}", ${fallbackFor(primary, kind)}`,
  };
}

export function resolveEmailFonts(theme: PropertyTheme): EmailFontStacks {
  const heading = stackFor(theme.typography?.headingFont);
  const body = stackFor(theme.typography?.bodyFont);
  return {
    headingDisplayName: heading.display,
    headingStack: heading.stack,
    bodyDisplayName: body.display,
    bodyStack: body.stack,
  };
}

// Hard-coded override for the Portico theme deployment (THEME=portico-ivory).
// The Portico site uses Cormorant Garamond + Inter, baked into the theme via
// next/font and not always reflected on `properties.theme.typography` (which
// the admin overwrites with their preferred stack). This keeps email fonts
// matching the live site regardless of what admin saved.
export const PORTICO_FONTS: EmailFontStacks = {
  headingDisplayName: "Cormorant Garamond",
  headingStack: `"Cormorant Garamond", Georgia, "Times New Roman", serif`,
  bodyDisplayName: "Inter",
  bodyStack: `"Inter", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`,
};
