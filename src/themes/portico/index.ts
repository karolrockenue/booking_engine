// Public surface of the Portico theme. Pages import from this barrel only.

import { getPropertyTheme, isPortico } from "@/lib/active-theme";
import { portico, type PorticoTokens } from "./tokens";

export { porticoImg, porticoLayout, portico, type PorticoTokens } from "./tokens";
export { PorticoShell } from "./PorticoShell";
export { Nav, BookingNav, Stepper } from "./components/Nav";
export { Btn, Pill, Field, Input, Select, Eyebrow } from "./components/primitives";

// Returns the active Portico tokens for the given property, or null when its
// template is not a Portico variant. Pass property.templateSlug from the DB.
export async function activePorticoTokens(
  propertyTemplateSlug: string | null | undefined
): Promise<PorticoTokens | null> {
  const theme = await getPropertyTheme(propertyTemplateSlug);
  if (!isPortico(theme)) return null;
  return portico[theme];
}
