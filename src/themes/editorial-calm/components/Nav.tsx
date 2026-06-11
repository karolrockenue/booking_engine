"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { EditorialCalmTokens } from "../tokens";

// Editorial Calm nav, exactly as the mockups:
//  · hero (`over`)  — wordmark + mono location label + underlined "Book a stay"
//  · inner pages    — wordmark + the three editorial links (The houses /
//    Journal / Neighbourhood). Journal & Neighbourhood are placeholder pages
//    in the mockup too — they link home until those pages exist.

export function Nav({
  t,
  name,
  over = false,
  location,
  cta = "Book a stay",
}: {
  t: EditorialCalmTokens;
  name: string;
  over?: boolean;
  location?: string;
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
      {over ? (
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          {location && (
            <span
              style={{
                fontFamily: "var(--ec-mono)",
                fontSize: 11.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: fg,
                opacity: 0.85,
              }}
            >
              {location}
            </span>
          )}
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
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 26 }} className="ec-nav-links">
          {["The houses", "Journal", "Neighbourhood"].map((l) => (
            <Link
              key={l}
              href={home}
              style={{
                fontFamily: "var(--ec-sans)",
                fontWeight: 400,
                fontSize: 13,
                letterSpacing: "0.01em",
                color: t.ink50,
                textDecoration: "none",
              }}
            >
              {l}
            </Link>
          ))}
        </div>
      )}
      <style>{`
        @media (max-width: 720px) {
          .ec-nav { padding: 20px 24px !important; }
          .ec-nav-links { display: none !important; }
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
          <span style={{ fontWeight: 400, margin: "0 0.02em" }}>&amp;</span>
          {parts[1]}
        </>
      ) : (
        name
      )}
    </span>
  );
}
