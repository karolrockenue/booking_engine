import type { Appearance } from "@stripe/stripe-js";
import type { PorticoTokens } from "./tokens";

// Stripe Elements `appearance` config tuned to the Portico palette. Used as
// the second argument to <Elements options={{ appearance }}>. The element
// blends with the page background instead of forcing white.

export function porticoStripeAppearance(t: PorticoTokens): Appearance {
  // Ivory variant: wrapper matches the ivory page bg; input fields stay white
  // so they read as elevated cards against the ivory ground.
  const wrapperBg = t.bg;
  const inputBg = "#ffffff";

  return {
    theme: "stripe",
    variables: {
      colorPrimary: t.accent,
      colorBackground: wrapperBg,
      colorText: t.ink,
      colorTextSecondary: t.inkSoft,
      colorDanger: "#c25a4d",
      fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
      fontSizeBase: "15px",
      spacingUnit: "4px",
      borderRadius: "0px",
    },
    rules: {
      ".Input": {
        backgroundColor: inputBg,
        border: `1px solid ${t.rule}`,
        color: t.ink,
        boxShadow: "none",
        padding: "14px 14px",
      },
      ".Input:focus": {
        borderColor: t.accent,
        boxShadow: "none",
      },
      ".Input--invalid": {
        borderColor: "#c25a4d",
      },
      ".Label": {
        color: t.inkSoft,
        fontSize: "10px",
        fontWeight: "500",
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        marginBottom: "8px",
      },
      ".Tab": {
        backgroundColor: inputBg,
        border: `1px solid ${t.rule}`,
        color: t.inkSoft,
      },
      ".Tab:hover": {
        color: t.ink,
        borderColor: t.inkSoft,
      },
      ".Tab--selected": {
        backgroundColor: inputBg,
        borderColor: t.accent,
        color: t.accent,
        boxShadow: "none",
      },
      ".TabIcon--selected": {
        fill: t.accent,
      },
      ".Block": {
        backgroundColor: inputBg,
        border: `1px solid ${t.rule}`,
      },
      ".PickerItem": {
        backgroundColor: inputBg,
      },
      ".CheckboxInput": {
        backgroundColor: inputBg,
        borderColor: t.rule,
      },
      ".Error": {
        color: "#c25a4d",
        fontSize: "12px",
      },
    },
  };
}
