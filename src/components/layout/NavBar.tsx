"use client";

import { useState } from "react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface NavBarProps {
  logoUrl?: string;
  /** Force solid background + hide booking CTA (for booking flow pages) */
  variant?: "default" | "booking";
  /** Hide the booking CTA button even in default variant */
  hideCta?: boolean;
}

export function NavBar({ logoUrl, variant = "default", hideCta = false }: NavBarProps) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = theme.nav?.links ?? [];
  const ctaText = theme.nav?.bookingCtaText ?? "Book Now";
  const isBookingFlow = variant === "booking";
  const isTransparent = !isBookingFlow && theme.style.navStyle === "transparent";
  const isSticky = isBookingFlow || theme.style.navStyle === "sticky";

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
        <div className="flex items-center gap-3">
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
          <span
            className="hidden sm:inline-flex items-center gap-1 text-[9px] uppercase tracking-widest px-2 py-1 rounded-full"
            style={{
              color: isTransparent ? "rgba(255,255,255,0.6)" : "var(--color-text-muted)",
              border: `1px solid ${isTransparent ? "rgba(255,255,255,0.2)" : "var(--color-border)"}`,
              fontWeight: 500,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"/></svg>
            Official Site
          </span>
        </div>

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
          {/* DEV links — only rendered in development */}
          {process.env.NODE_ENV !== "production" && (
            <div className="flex items-center gap-2">
              {[
                { href: "/bars", label: "Bars" },
                { href: "/compare-live", label: "Compare" },
                { href: "/fonts", label: "Fonts" },
                { href: "/rates", label: "Rates" },
                { href: "/enhance", label: "Enhance" },
                { href: "/rooms-mockup", label: "Rooms" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[10px] uppercase tracking-widest px-2 py-1 rounded transition-opacity hover:opacity-70"
                  style={{
                    color: isTransparent ? "rgba(255,255,255,0.5)" : "var(--color-text-muted)",
                    border: `1px solid ${isTransparent ? "rgba(255,255,255,0.2)" : "var(--color-border)"}`,
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
          {!isBookingFlow && !hideCta && (
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
          )}
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
          {!isBookingFlow && !hideCta && (
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
          )}
        </div>
      )}
    </nav>
  );
}
