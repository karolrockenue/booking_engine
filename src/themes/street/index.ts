// Public surface of the Street theme. Pages import from this barrel only.

import { getPropertyTheme, isStreet } from "@/lib/active-theme";
import { street, type StreetTokens } from "./tokens";

export { streetImg, streetLayout, street, type StreetTokens } from "./tokens";
export { StreetShell } from "./StreetShell";
export { Nav } from "./components/Nav";
export {
  Btn,
  Field,
  Input,
  Select,
  Eyebrow,
  SerifH,
  Hairline,
} from "./components/primitives";
export { BookingNav } from "./components/BookingNav";
export { StreetHome } from "./screens/Home";
export { StreetExtras } from "./screens/Extras";
export { StreetCheckout } from "./screens/Checkout";
export { StreetConfirmation } from "./screens/Confirmation";

// Returns the active Street tokens for the given property, or null when its
// template is not a Street variant. Pass property.templateSlug from the DB.
export async function activeStreetTokens(
  propertyTemplateSlug: string | null | undefined
): Promise<StreetTokens | null> {
  const theme = await getPropertyTheme(propertyTemplateSlug);
  if (!isStreet(theme)) return null;
  return street[theme];
}
