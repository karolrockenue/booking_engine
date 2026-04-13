export interface PropertyTheme {
  // Identity
  name: string;
  slug: string;
  domain: string;

  // Color palette
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    error: string;
    success: string;
  };

  // Typography
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: string;
    bodyWeight: string;
    baseSize: string;
    scale: number;
    headingLetterSpacing: string;
    bodyLineHeight: string;
  };

  // Spacing & Layout
  layout: {
    maxWidth: string;
    borderRadius: string;
    buttonRadius: string;
    cardRadius: string;
    sectionPadding: string;
    containerPadding: string;
  };

  // Visual style
  style: {
    imageAspectRatio: string;
    imageTreatment: "none" | "rounded" | "shadow" | "border";
    buttonStyle: "solid" | "outline" | "ghost";
    navStyle: "transparent" | "solid" | "sticky";
    heroStyle: "fullbleed" | "contained" | "split";
    animationLevel: "none" | "subtle" | "rich";
  };

  // Contact
  contact: {
    address: string;
    phone: string;
    email: string;
  };

  // Social
  social: {
    instagram: string | null;
    facebook: string | null;
    tripadvisor: string | null;
  };

  // Hero
  hero: {
    headline: string;
    subheadline: string;
    imageUrl: string | null;
    overlayOpacity: number;
  };

  // Navigation
  nav: {
    links: Array<{ label: string; href: string }>;
    bookingCtaText: string;
  };
}

export interface PageSection {
  component: string;
  props: Record<string, unknown>;
}

export interface PageLayout {
  sections: PageSection[];
}

/** Convert theme tokens to CSS custom properties */
export function themeToCSSVars(theme: PropertyTheme): Record<string, string> {
  return {
    "--color-primary": theme.colors.primary,
    "--color-secondary": theme.colors.secondary,
    "--color-accent": theme.colors.accent,
    "--color-background": theme.colors.background,
    "--color-surface": theme.colors.surface,
    "--color-text": theme.colors.text,
    "--color-text-muted": theme.colors.textMuted,
    "--color-border": theme.colors.border,
    "--color-error": theme.colors.error,
    "--color-success": theme.colors.success,

    "--font-heading": theme.typography.headingFont,
    "--font-body": theme.typography.bodyFont,
    "--font-heading-weight": theme.typography.headingWeight,
    "--font-body-weight": theme.typography.bodyWeight,
    "--font-base-size": theme.typography.baseSize,
    "--font-scale": theme.typography.scale.toString(),
    "--font-heading-letter-spacing": theme.typography.headingLetterSpacing,
    "--font-body-line-height": theme.typography.bodyLineHeight,

    "--layout-max-width": theme.layout.maxWidth,
    "--radius": theme.layout.borderRadius,
    "--radius-button": theme.layout.buttonRadius,
    "--radius-card": theme.layout.cardRadius,
    "--section-padding": theme.layout.sectionPadding,
    "--container-padding": theme.layout.containerPadding,
  };
}

/** Default/fallback theme for development */
export const defaultTheme: PropertyTheme = {
  name: "Demo Hotel",
  slug: "demo",
  domain: "localhost",
  colors: {
    primary: "#2C3E50",
    secondary: "#C9A96E",
    accent: "#8B4513",
    background: "#FAF8F5",
    surface: "#FFFFFF",
    text: "#1A1A1A",
    textMuted: "#6B7280",
    border: "#E5E0D8",
    error: "#DC2626",
    success: "#059669",
  },
  typography: {
    headingFont: "Georgia, serif",
    bodyFont: "system-ui, sans-serif",
    headingWeight: "700",
    bodyWeight: "400",
    baseSize: "16px",
    scale: 1.25,
    headingLetterSpacing: "-0.02em",
    bodyLineHeight: "1.6",
  },
  layout: {
    maxWidth: "1280px",
    borderRadius: "2px",
    buttonRadius: "0px",
    cardRadius: "4px",
    sectionPadding: "96px",
    containerPadding: "24px",
  },
  style: {
    imageAspectRatio: "3:2",
    imageTreatment: "none",
    buttonStyle: "solid",
    navStyle: "transparent",
    heroStyle: "fullbleed",
    animationLevel: "subtle",
  },
  contact: {
    address: "",
    phone: "",
    email: "",
  },
  social: {
    instagram: null,
    facebook: null,
    tripadvisor: null,
  },
  hero: {
    headline: "Welcome",
    subheadline: "Book direct for the best rate",
    imageUrl: null,
    overlayOpacity: 0.45,
  },
  nav: {
    links: [],
    bookingCtaText: "Book Now",
  },
};
