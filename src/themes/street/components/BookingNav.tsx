"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { StreetTokens } from "../tokens";
import { StreetLogo } from "./Logo";

// Booking-flow chrome for Street — distinct from the marketing Nav. A typographic
// logo on the left, a 4-step progress indicator centred, and an optional phone
// on the right. Mirrors Portico's BookingNav but in Street's austere language:
// gold-accent active step, hairline rules, no solid fills.

const STEPS = ["Dates", "Room", "Extras", "Checkout"] as const;
export type StepIndex = 0 | 1 | 2 | 3;

export function BookingNav({
  t,
  step,
  name,
  subtitle,
  phone,
}: {
  t: StreetTokens;
  step: StepIndex;
  name: string;
  subtitle?: string;
  phone?: string;
}) {
  const slug = useParams<{ property: string }>().property ?? "";
  const home = `/${slug}`;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 40px",
        borderBottom: `1px solid ${t.ruleSoft}`,
        background: t.bg,
        color: t.ink,
        fontFamily: "var(--street-sans)",
        gap: 16,
      }}
      className="street-bookingnav"
    >
      <Link href={home} style={{ color: "inherit", textDecoration: "none" }} aria-label={`${name} — home`}>
        <StreetLogo t={t} name={name} subtitle={subtitle} />
      </Link>

      <Stepper t={t} step={step} />

      {phone ? (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.inkSoft,
            textDecoration: "none",
            fontWeight: 500,
          }}
          className="street-bookingnav-phone"
        >
          {phone}
        </a>
      ) : (
        <span className="street-bookingnav-spacer" style={{ width: 120 }} />
      )}

      <style>{`
        @media (max-width: 760px) {
          .street-bookingnav {
            flex-wrap: wrap !important;
            row-gap: 12px !important;
            padding: 16px 22px !important;
          }
          .street-bookingnav > a:first-child { margin-right: auto; }
          .street-bookingnav-phone { display: none !important; }
          .street-bookingnav-spacer { display: none !important; }
          .street-stepper-compact { width: 100%; justify-content: flex-start !important; }
        }
      `}</style>
    </div>
  );
}

function Stepper({ t, step }: { t: StreetTokens; step: StepIndex }) {
  return (
    <>
      {/* Desktop — full 4-step layout */}
      <div
        style={{
          display: "flex",
          gap: 30,
          fontSize: 12,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontFamily: "var(--street-sans)",
          fontWeight: 500,
        }}
        className="street-stepper-full"
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
                color: active ? t.accent : done ? t.ink : t.inkMuted,
                borderBottom: active ? `1px solid ${t.accent}` : "none",
                paddingBottom: 4,
              }}
            >
              <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 10, opacity: 0.8 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{label}</span>
            </span>
          );
        })}
      </div>

      {/* Mobile — current step + progress ticks */}
      <div
        style={{
          display: "none",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--street-sans)",
        }}
        className="street-stepper-compact"
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
          .street-stepper-full { display: none !important; }
          .street-stepper-compact { display: inline-flex !important; }
        }
      `}</style>
    </>
  );
}
