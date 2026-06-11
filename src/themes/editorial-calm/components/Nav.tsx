"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { EditorialCalmTokens } from "../tokens";

// Minimal Editorial Calm nav: property wordmark left, one booking action
// right. `over` = sitting on the hero photo (white type, absolute position).

export function Nav({
  t,
  name,
  over = false,
  cta = "Book a stay",
}: {
  t: EditorialCalmTokens;
  name: string;
  over?: boolean;
  cta?: string;
}) {
  const slug = useParams<{ property: string }>().property ?? "";
  const home = `/${slug}`;
  const fg = over ? "#fff" : t.ink;

  return (
    <nav
      style={{
        position: over ? "absolute" : "relative",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "26px 40px",
        height: 78,
        borderBottom: over ? "none" : `1px solid ${t.line}`,
        background: over ? "transparent" : t.paper,
      }}
      className="ec-nav"
    >
      <Link href={home} aria-label={`${name} — home`} style={{ textDecoration: "none" }}>
        <Wordmark name={name} color={fg} />
      </Link>
      <Link
        href={home}
        style={{
          fontFamily: "var(--ec-sans)",
          fontWeight: 500,
          fontSize: 14.5,
          color: fg,
          borderBottom: `1px solid ${fg}`,
          paddingBottom: 2,
          textDecoration: "none",
        }}
      >
        {cta}
      </Link>
      <style>{`
        @media (max-width: 720px) {
          .ec-nav { padding: 20px 24px !important; }
        }
      `}</style>
    </nav>
  );
}

// Typographic wordmark — the property's name set in the structural sans.
// An "&" between words gets the mockup's lighter-weight treatment.
export function Wordmark({
  name,
  color,
  size = 21,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const parts = name.split(/\s*&\s*/);
  return (
    <span
      style={{
        fontFamily: "var(--ec-sans)",
        fontWeight: 500,
        fontSize: size,
        letterSpacing: "-0.012em",
        color,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {parts.length === 2 ? (
        <>
          {parts[0]}
          <span style={{ fontWeight: 400, margin: "0 0.06em" }}>&amp;</span>
          {parts[1]}
        </>
      ) : (
        name
      )}
    </span>
  );
}
