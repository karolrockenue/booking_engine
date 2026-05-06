import type { ReactNode } from "react";
import Link from "next/link";
import { porticoSerif, porticoSans } from "./fonts";
import type { PorticoTokens } from "./tokens";

// Wraps every Portico page. Provides the self-hosted Cormorant Garamond +
// Inter via next/font (scoped to Portico subtrees) and the page background.

export function PorticoShell({
  t,
  children,
  fullBleed = false,
}: {
  t: PorticoTokens;
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div
      className={`portico-shell ${porticoSerif.variable} ${porticoSans.variable}`}
      style={{
        minHeight: "100dvh",
        background: t.bg,
        color: t.ink,
        fontFamily: "var(--portico-sans)",
        display: fullBleed ? "block" : "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        /* Mobile guardrail — prevent any rogue overflow from breaking layout */
        html, body { overflow-x: hidden; }
        .portico-shell { overflow-x: clip; max-width: 100vw; }
        .portico-shell img { max-width: 100%; height: auto; }
        .portico-shell button:focus-visible,
        .portico-shell a:focus-visible,
        .portico-shell input:focus-visible,
        .portico-shell textarea:focus-visible,
        .portico-shell select:focus-visible {
          outline: 2px solid ${t.accent};
          outline-offset: 2px;
        }
        .portico-shell input::placeholder,
        .portico-shell textarea::placeholder {
          color: ${t.inkSoft};
          opacity: 1;
        }
      `}</style>
      {children}
      {isDev && <DevThemeBadge t={t} />}
    </div>
  );
}

function DevThemeBadge({ t }: { t: PorticoTokens }) {
  return (
    <Link
      href="/dev/themes"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 1000,
        background: t.accent,
        color: t.accentInk,
        padding: "8px 14px",
        fontSize: 9,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        textDecoration: "none",
        fontFamily: "var(--portico-sans)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
      }}
    >
      Theme · Ivory ⇄
    </Link>
  );
}
