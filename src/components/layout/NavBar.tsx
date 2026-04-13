"use client";

import { useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface NavBarProps {
  logoUrl?: string;
}

export function NavBar({ logoUrl }: NavBarProps) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = theme.nav?.links ?? [];
  const ctaText = theme.nav?.bookingCtaText ?? "Book Now";
  const isTransparent = theme.style.navStyle === "transparent";
  const isSticky = theme.style.navStyle === "sticky";

  return (
    <nav
      className={`w-full z-50 ${isSticky ? "sticky top-0" : ""} ${isTransparent ? "absolute top-0 left-0" : ""}`}
      style={{
        backgroundColor: isTransparent ? "transparent" : "var(--color-surface)",
        borderBottom: isTransparent ? "none" : "1px solid var(--color-border)",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between py-4"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        <a
          href="/"
          className="text-xl font-bold tracking-wide"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--font-heading-weight)",
            letterSpacing: "var(--font-heading-letter-spacing)",
            color: isTransparent ? "#FFFFFF" : "var(--color-text)",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={theme.name} className="h-10" />
          ) : (
            theme.name
          )}
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm uppercase tracking-wider transition-opacity hover:opacity-70"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "500",
                color: isTransparent ? "#FFFFFF" : "var(--color-text)",
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/"
            className="px-6 py-2 text-sm uppercase tracking-wider transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "600",
              borderRadius: "var(--radius-button)",
              backgroundColor:
                theme.style.buttonStyle === "outline"
                  ? "transparent"
                  : "var(--color-secondary)",
              color:
                theme.style.buttonStyle === "outline"
                  ? isTransparent
                    ? "#FFFFFF"
                    : "var(--color-secondary)"
                  : "#FFFFFF",
              border: `2px solid ${theme.style.buttonStyle === "outline" ? (isTransparent ? "#FFFFFF" : "var(--color-secondary)") : "var(--color-secondary)"}`,
            }}
          >
            {ctaText}
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{ color: isTransparent ? "#FFFFFF" : "var(--color-text)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden px-[var(--container-padding)] pb-6 flex flex-col gap-4"
          style={{ backgroundColor: "var(--color-surface)" }}
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm uppercase tracking-wider py-2"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "500",
                color: "var(--color-text)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/"
            className="px-6 py-3 text-sm uppercase tracking-wider text-center"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "600",
              borderRadius: "var(--radius-button)",
              backgroundColor: "var(--color-secondary)",
              color: "#FFFFFF",
            }}
          >
            {ctaText}
          </a>
        </div>
      )}
    </nav>
  );
}
