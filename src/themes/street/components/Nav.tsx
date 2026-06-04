"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { StreetTokens } from "../tokens";
import { StreetLogo } from "./Logo";

const NAV_LINKS = [
  { label: "Stay", id: "stay", href: "/" },
  { label: "Rooms", id: "rooms", href: "/#rooms" },
  { label: "The area", id: "area", href: "/#neighbourhood" },
  { label: "Contact", id: "contact", href: "/#contact" },
];

interface Props {
  t: StreetTokens;
  name: string;
  subtitle?: string;
  current?: string;
}

export function Nav({ t, name, subtitle, current = "stay" }: Props) {
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
        padding: "20px 40px",
        borderBottom: `1px solid ${t.ruleSoft}`,
        background: t.bg,
        color: t.ink,
        fontFamily: "var(--street-sans)",
      }}
      className="street-nav"
    >
      <Link
        href={home}
        style={{ color: "inherit", textDecoration: "none" }}
        aria-label={`${name} — home`}
      >
        <StreetLogo t={t} name={name} subtitle={subtitle} />
      </Link>

      <div
        style={{
          display: "flex",
          gap: 32,
          fontSize: 12,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontWeight: 500,
        }}
        className="street-nav-links"
      >
        {NAV_LINKS.map((l) => {
          const isActive = current === l.id;
          const href = l.id === "stay" ? home : `${home}${l.href.slice(1)}`;
          return (
            <Link
              key={l.id}
              href={href}
              style={{
                color: isActive ? t.ink : t.inkSoft,
                textDecoration: "none",
                borderBottom: isActive ? `1px solid ${t.accent}` : "none",
                paddingBottom: 4,
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className="street-nav-burger"
        style={{
          display: "none",
          background: "transparent",
          border: "none",
          color: t.ink,
          cursor: "pointer",
          padding: 8,
          margin: -8,
        }}
      >
        <BurgerIcon />
      </button>

      {menuOpen && (
        <MobileMenu
          t={t}
          home={home}
          name={name}
          subtitle={subtitle}
          onClose={() => setMenuOpen(false)}
        />
      )}

      <style>{`
        @media (max-width: 760px) {
          .street-nav { padding: 16px 22px !important; }
          .street-nav-links { display: none !important; }
          .street-nav-burger { display: flex !important; align-items: center; justify-content: center; }
        }
      `}</style>
    </nav>
  );
}

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <line x1="3" y1="7" x2="19" y2="7" />
      <line x1="3" y1="15" x2="19" y2="15" />
    </svg>
  );
}

function MobileMenu({
  t,
  home,
  name,
  subtitle,
  onClose,
}: {
  t: StreetTokens;
  home: string;
  name: string;
  subtitle?: string;
  onClose: () => void;
}) {
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
        fontFamily: "var(--street-sans)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 22px",
          borderBottom: `1px solid ${t.ruleSoft}`,
        }}
      >
        <Link
          href={home}
          onClick={onClose}
          aria-label="Home"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <StreetLogo t={t} name={name} subtitle={subtitle} size="sm" />
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
            letterSpacing: "0.22em",
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
          padding: "32px 22px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {NAV_LINKS.map((l) => {
          const href = l.id === "stay" ? home : `${home}${l.href.slice(1)}`;
          return (
            <Link
              key={l.id}
              href={href}
              onClick={onClose}
              style={{
                fontFamily: "var(--street-serif)",
                fontSize: 30,
                lineHeight: 1.4,
                letterSpacing: "-0.01em",
                color: t.ink,
                textDecoration: "none",
                padding: "14px 0",
                borderBottom: `1px solid ${t.ruleSoft}`,
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
