// Public surface of the Editorial Calm theme. Pages import from this barrel.

import { getPropertyTheme, isEditorialCalm } from "@/lib/active-theme";
import { editorialCalm, type EditorialCalmTokens } from "./tokens";

export { ecImg, ecLayout, editorialCalm, type EditorialCalmTokens } from "./tokens";
export { EditorialCalmShell } from "./EditorialCalmShell";
export { EditorialCalmHome } from "./screens/Home";
export { EditorialCalmRoomSelect } from "./screens/RoomSelect";
export { EditorialCalmExtras } from "./screens/Extras";
export { EditorialCalmCheckout } from "./screens/Checkout";
export { EditorialCalmConfirmation } from "./screens/Confirmation";

// Returns the active Editorial Calm tokens for the given property, or null
// when its template is not an Editorial Calm variant.
export async function activeEditorialCalmTokens(
  propertyTemplateSlug: string | null | undefined
): Promise<EditorialCalmTokens | null> {
  const theme = await getPropertyTheme(propertyTemplateSlug);
  if (!isEditorialCalm(theme)) return null;
  return editorialCalm[theme];
}
