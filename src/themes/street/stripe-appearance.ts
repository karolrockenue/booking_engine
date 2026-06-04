import type { Appearance } from "@stripe/stripe-js";
import type { StreetTokens } from "./tokens";

// Stripe Elements `appearance` for the Street palette. Matches the cream
// ground: borderless underline inputs to echo the rest of the chrome.

export function streetStripeAppearance(t: StreetTokens): Appearance {
  const wrapperBg = t.bg;
  const inputBg = "transparent";

  return {
    theme: "stripe",
    variables: {
      colorPrimary: t.ink,
      colorBackground: wrapperBg,
      colorText: t.ink,
      colorTextSecondary: t.inkSoft,
      colorDanger: "#b54a3a",
      fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
      fontSizeBase: "15px",
      spacingUnit: "4px",
      borderRadius: "0px",
    },
    rules: {
      ".Input": {
        backgroundColor: inputBg,
        border: "0",
        borderBottom: `1px solid ${t.rule}`,
        color: t.ink,
        boxShadow: "none",
        padding: "12px 0",
        borderRadius: "0",
      },
      ".Input:focus": {
        borderBottomColor: t.ink,
        boxShadow: "none",
      },
      ".Input--invalid": {
        borderBottomColor: "#b54a3a",
      },
      ".Label": {
        color: t.inkSoft,
        fontSize: "10px",
        fontWeight: "500",
        letterSpacing: "0.28em",
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
        borderColor: t.ink,
      },
      ".Tab--selected": {
        backgroundColor: inputBg,
        borderColor: t.ink,
        color: t.ink,
        boxShadow: "none",
      },
      ".TabIcon--selected": {
        fill: t.ink,
      },
      ".Block": {
        backgroundColor: inputBg,
        border: `1px solid ${t.rule}`,
      },
      ".CheckboxInput": {
        backgroundColor: inputBg,
        borderColor: t.rule,
      },
      ".Error": {
        color: "#b54a3a",
        fontSize: "12px",
      },
    },
  };
}
