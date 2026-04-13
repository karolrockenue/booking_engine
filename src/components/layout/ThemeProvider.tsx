"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type PropertyTheme, defaultTheme, themeToCSSVars } from "@/lib/theme";

const ThemeContext = createContext<PropertyTheme>(defaultTheme);

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme: PropertyTheme;
  children: ReactNode;
}) {
  const cssVars = themeToCSSVars(theme);

  return (
    <ThemeContext.Provider value={theme}>
      <div style={cssVars as React.CSSProperties}>{children}</div>
    </ThemeContext.Provider>
  );
}
