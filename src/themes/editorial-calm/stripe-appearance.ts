import type { Appearance } from "@stripe/stripe-js";
import type { EditorialCalmTokens } from "./tokens";

// Stripe Elements `appearance` for Editorial Calm. Matches the paper ground:
// underline fields (like the rest of the form chrome), soft radii on tabs.

export function editorialCalmStripeAppearance(t: EditorialCalmTokens): Appearance {
  return {
    theme: "stripe",
    variables: {
      colorPrimary: t.ink,
      colorBackground: t.paper,
      colorText: t.ink,
      colorTextSecondary: t.ink70,
      colorDanger: "#B82626",
      fontFamily: '"Hanken Grotesk", -apple-system, system-ui, sans-serif',
      fontSizeBase: "15px",
      spacingUnit: "4px",
      borderRadius: "10px",
    },
    rules: {
      ".Input": {
        backgroundColor: "transparent",
        border: "0",
        borderBottom: `1px solid ${t.line2}`,
        color: t.ink,
        boxShadow: "none",
        padding: "11px 2px",
        borderRadius: "0",
      },
      ".Input:focus": {
        borderBottomColor: t.ink,
        boxShadow: "none",
      },
      ".Input--invalid": {
        borderBottomColor: "#B82626",
      },
      ".Label": {
        color: t.ink,
        fontSize: "13px",
        fontWeight: "500",
        marginBottom: "4px",
      },
      ".Tab": {
        backgroundColor: "transparent",
        border: `1px solid ${t.line2}`,
        color: t.ink70,
        borderRadius: "10px",
      },
      ".Tab:hover": {
        color: t.ink,
        borderColor: t.ink,
      },
      ".Tab--selected": {
        backgroundColor: "transparent",
        borderColor: t.ink,
        color: t.ink,
        boxShadow: "none",
      },
      ".TabIcon--selected": {
        fill: t.ink,
      },
      ".Block": {
        backgroundColor: "transparent",
        border: `1px solid ${t.line}`,
      },
      ".Error": {
        color: "#B82626",
        fontSize: "12px",
      },
    },
  };
}
