import type { ReactNode } from "react";
import Link from "next/link";
import { ecSans, ecSerif, ecMono } from "./fonts";
import type { EditorialCalmTokens } from "./tokens";

// Wraps every Editorial Calm page. Loads the three faces via next/font scoped
// to the subtree, applies the paper background, and provides focus styles.

export function EditorialCalmShell({
  t,
  children,
}: {
  t: EditorialCalmTokens;
  children: ReactNode;
}) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <div
      className={`ec-shell ${ecSans.variable} ${ecSerif.variable} ${ecMono.variable}`}
      style={{
        minHeight: "100dvh",
        background: t.paper,
        color: t.ink,
        fontFamily: "var(--ec-sans)",
        display: "flex",
        flexDirection: "column",
        lineHeight: 1.45,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{`
        html, body { overflow-x: hidden; }
        .ec-shell { overflow-x: clip; max-width: 100vw; }
        .ec-shell img { max-width: 100%; height: auto; }
        .ec-shell a { color: inherit; text-decoration: none; }
        .ec-shell button { font-family: inherit; }
        .ec-shell button:focus-visible,
        .ec-shell a:focus-visible,
        .ec-shell input:focus-visible,
        .ec-shell textarea:focus-visible,
        .ec-shell select:focus-visible {
          outline: 2px solid ${t.ink};
          outline-offset: 3px;
        }
        .ec-shell input::placeholder,
        .ec-shell textarea::placeholder {
          color: ${t.ink50};
          opacity: 1;
        }
      `}</style>
      {children}
      {isDev && <DevThemeBadge t={t} />}
    </div>
  );
}

function DevThemeBadge({ t }: { t: EditorialCalmTokens }) {
  return (
    <Link
      href="/dev/themes"
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 1000,
        background: t.ink,
        color: t.paper,
        padding: "8px 14px",
        fontSize: 9,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        textDecoration: "none",
        fontFamily: "var(--ec-mono)",
        borderRadius: 100,
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
      }}
    >
      Theme · Editorial Calm ⇄
    </Link>
  );
}
