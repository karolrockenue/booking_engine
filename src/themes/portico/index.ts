// Public surface of the Portico theme. Pages import from this barrel only.

import { getActiveTheme, isPortico } from "@/lib/active-theme";
import { portico, type PorticoTokens } from "./tokens";

export { porticoImg, porticoLayout, portico, type PorticoTokens } from "./tokens";
export { PorticoShell } from "./PorticoShell";
export { Nav, BookingNav, Stepper } from "./components/Nav";
export { Btn, Pill, Field, Input, Eyebrow } from "./components/primitives";

// Returns the active Portico tokens for the current deployment, or null when
// THEME=default. Server-only — depends on process.env / dev cookie.
export async function activePorticoTokens(): Promise<PorticoTokens | null> {
  const theme = await getActiveTheme();
  if (!isPortico(theme)) return null;
  return portico[theme];
}
