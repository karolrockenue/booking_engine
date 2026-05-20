"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PorticoTokens } from "../tokens";
import { PorticoLogo } from "./Logo";

// Cross-page links to homepage anchors use "/#anchor" so they work from
// /book, /extras, /checkout etc. (and degrade to scrolling on / itself).
const NAV_LINKS = [
  { label: "Neighbourhood", href: "/#neighbourhood" },
  { label: "Contact", href: "/#contact" },
  { label: "Good to know", href: "/#good-to-know" },
];

interface Props {
  t: PorticoTokens;
  variant?: "transparent" | "solid";
  current?: string;
  inkOverride?: string;
}

export function Nav({ t, variant = "solid", current, inkOverride }: Props) {
  const ink = inkOverride ?? t.ink;
  const slug = useParams<{ property: string }>().property ?? "";
  const home = `/${slug}`;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      style={{
        position: "relative",
        zIndex: 5,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "24px 48px",
        borderBottom: variant === "solid" ? `1px solid ${t.rule}` : "none",
        color: ink,
        background: variant === "solid" ? t.bg : "transparent",
        fontFamily: "var(--portico-sans)",
      }}
      className="portico-nav"
    >
      <Link href={home} style={{ color: "inherit", textDecoration: "none" }} aria-label="The Portico Hotel — home">
        <PorticoLogo
          height={42}
          surface={variant === "transparent" ? "dark" : "light"}
        />
      </Link>

      {/* Desktop links */}
      <div
        style={{
          display: "flex",
          gap: 30,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}
        className="portico-nav-links"
      >
        {NAV_LINKS.map((l) => (
          <Link
            key={l.label}
            href={`${home}${l.href.slice(1)}`}
            style={{
              color: "inherit",
              textDecoration: "none",
              borderBottom: current === l.label.toLowerCase() ? `1px solid ${ink}` : "none",
              paddingBottom: 2,
              opacity: 0.95,
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <Link
        href={`${home}/book`}
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.accentInk,
          background: t.accent,
          padding: "11px 22px",
          textDecoration: "none",
          fontWeight: 500,
          transition: "filter 150ms ease, transform 150ms ease",
          border: "none",
          fontFamily: "var(--portico-sans)",
        }}
        className="portico-nav-cta"
      >
        Book a stay
      </Link>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className="portico-nav-burger"
        style={{
          display: "none",
          background: "transparent",
          border: "none",
          color: ink,
          cursor: "pointer",
          padding: 8,
          margin: -8,
        }}
      >
        <BurgerIcon />
      </button>

      {menuOpen && <MobileMenu t={t} home={home} onClose={() => setMenuOpen(false)} />}

      <style>{`
        .portico-nav-cta:hover {
          filter: brightness(1.1);
        }
        @media (max-width: 760px) {
          .portico-nav { padding: 18px 24px !important; }
          .portico-nav-links { display: none !important; }
          .portico-nav-cta { display: none !important; }
          .portico-nav-burger { display: flex !important; align-items: center; justify-content: center; }
        }
      `}</style>
    </nav>
  );
}

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <line x1="3" y1="7" x2="19" y2="7" />
      <line x1="3" y1="15" x2="19" y2="15" />
    </svg>
  );
}

function MobileMenu({ t, home, onClose }: { t: PorticoTokens; home: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: t.bg,
        color: t.ink,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--portico-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 24px",
          borderBottom: `1px solid ${t.rule}`,
        }}
      >
        <Link href={home} onClick={onClose} aria-label="Home" style={{ color: "inherit", textDecoration: "none" }}>
          <PorticoLogo height={36} surface="light" />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          style={{
            background: "transparent",
            border: "none",
            color: t.ink,
            cursor: "pointer",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            padding: "8px 0",
            fontFamily: "inherit",
          }}
        >
          Close ×
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {NAV_LINKS.map((l) => (
          <Link
            key={l.label}
            href={`${home}${l.href.slice(1)}`}
            onClick={onClose}
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 32,
              lineHeight: 1.4,
              letterSpacing: "-0.01em",
              color: t.ink,
              textDecoration: "none",
              padding: "14px 0",
              borderBottom: `1px solid ${t.rule}`,
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div style={{ padding: "24px", borderTop: `1px solid ${t.rule}` }}>
        <Link
          href={`${home}/book`}
          onClick={onClose}
          style={{
            display: "block",
            background: t.accent,
            color: t.accentInk,
            padding: "16px 26px",
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            textDecoration: "none",
            textAlign: "center",
            fontFamily: "var(--portico-sans)",
          }}
        >
          Book a room →
        </Link>
      </div>
    </div>
  );
}

export function BookingNav({
  t,
  step,
  phone,
}: {
  t: PorticoTokens;
  step: StepIndex;
  phone?: string;
}) {
  const home = `/${useParams<{ property: string }>().property ?? ""}`;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 48px",
        borderBottom: `1px solid ${t.rule}`,
        background: t.bg,
        color: t.ink,
        fontFamily: "var(--portico-sans)",
        gap: 16,
      }}
      className="portico-bookingnav"
    >
      <Link href={home} style={{ color: "inherit", textDecoration: "none" }} aria-label="Home">
        <PorticoLogo height={36} surface="light" />
      </Link>
      <Stepper t={t} step={step} />
      {phone ? (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: t.inkSoft,
            textDecoration: "none",
          }}
          className="portico-bookingnav-phone"
        >
          {phone}
        </a>
      ) : (
        <span className="portico-bookingnav-spacer" style={{ width: 120 }} />
      )}

      <style>{`
        @media (max-width: 760px) {
          .portico-bookingnav {
            flex-wrap: wrap !important;
            row-gap: 10px !important;
            padding: 14px 20px !important;
            justify-content: center !important;
          }
          .portico-bookingnav > a:first-child {
            margin-right: auto;
          }
          .portico-bookingnav-phone { display: none !important; }
          .portico-bookingnav-spacer { display: none !important; }
          .portico-stepper-compact { width: 100%; justify-content: flex-start !important; }
        }
      `}</style>
    </div>
  );
}

const STEPS = ["Dates", "Room", "Extras", "Checkout"] as const;
export type StepIndex = 0 | 1 | 2 | 3;

export function Stepper({ t, step }: { t: PorticoTokens; step: StepIndex }) {
  return (
    <>
      {/* Desktop — full 4-step layout */}
      <div
        style={{
          display: "flex",
          gap: 32,
          fontSize: 13,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontFamily: "var(--portico-sans)",
          fontWeight: 500,
        }}
        className="portico-stepper-full"
      >
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <span
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: active ? t.accent : done ? t.ink : t.inkSoft,
                borderBottom: active ? `2px solid ${t.accent}` : "none",
                paddingBottom: 4,
              }}
            >
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 11, opacity: 0.8 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{label}</span>
            </span>
          );
        })}
      </div>

      {/* Mobile — current step + progress */}
      <div
        style={{
          display: "none",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--portico-sans)",
        }}
        className="portico-stepper-compact"
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      >
        <span style={{ display: "inline-flex", gap: 4 }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: 18,
                height: 2,
                background: i <= step ? t.accent : t.rule,
              }}
            />
          ))}
        </span>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.accent,
            fontWeight: 500,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(step + 1).padStart(2, "0")} · {STEPS[step]}
        </span>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .portico-stepper-full { display: none !important; }
          .portico-stepper-compact { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}
