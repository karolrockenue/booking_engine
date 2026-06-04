import type { ReactNode } from "react";
import Link from "next/link";
import { streetSerif, streetSans } from "./fonts";
import type { StreetTokens } from "./tokens";

// Wraps every Street page. Loads Fraunces (serif) + Inter (sans) via next/font
// scoped to the Street subtree, applies the cream background, and provides a
// focus-visible style matched to the accent.

export function StreetShell({
  t,
  children,
  fullBleed = false,
}: {
  t: StreetTokens;
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div
      className={`street-shell ${streetSerif.variable} ${streetSans.variable}`}
      style={{
        minHeight: "100dvh",
        background: t.bg,
        color: t.ink,
        fontFamily: "var(--street-sans)",
        display: fullBleed ? "block" : "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        html, body { overflow-x: hidden; }
        .street-shell { overflow-x: clip; max-width: 100vw; }
        .street-shell img { max-width: 100%; height: auto; }
        .street-shell button:focus-visible,
        .street-shell a:focus-visible,
        .street-shell input:focus-visible,
        .street-shell textarea:focus-visible,
        .street-shell select:focus-visible {
          outline: 2px solid ${t.ink};
          outline-offset: 3px;
        }
        .street-shell input::placeholder,
        .street-shell textarea::placeholder {
          color: ${t.inkMuted};
          opacity: 1;
        }
      `}</style>
      {children}
      {isDev && <DevThemeBadge t={t} />}
    </div>
  );
}

function DevThemeBadge({ t }: { t: StreetTokens }) {
  return (
    <Link
      href="/dev/themes"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 1000,
        background: t.ink,
        color: t.bg,
        padding: "8px 14px",
        fontSize: 9,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        textDecoration: "none",
        fontFamily: "var(--street-sans)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      }}
    >
      Theme · Street ⇄
    </Link>
  );
}
