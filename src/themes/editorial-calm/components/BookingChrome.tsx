"use client";

import type { ReactNode } from "react";
import type { EditorialCalmTokens } from "../tokens";
import { Bracket, Mono } from "./primitives";

// Booking-flow chrome shared by room select / rate & extras / checkout:
// the step bar (mono summary of the stay + Edit link) and the step dots.

export function StepBar({
  t,
  step,
  label,
  summary,
  editHref,
}: {
  t: EditorialCalmTokens;
  step: 1 | 2 | 3;
  label: string;
  summary: string;
  editHref: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 40px",
        borderBottom: `1px solid ${t.line}`,
        flexWrap: "wrap",
        gap: 14,
      }}
      className="ec-stepbar"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Bracket t={t} size={11.5}>STEP {step} / 3</Bracket>
        <Mono t={t} size={11}>{label}</Mono>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Mono t={t} size={11.5} tight color={t.ink70}>
          {"{ YOUR STAY }"}&nbsp; {summary}
        </Mono>
        <a
          href={editHref}
          style={{
            fontFamily: "var(--ec-sans)",
            fontWeight: 500,
            fontSize: 13.5,
            color: t.ink,
            borderBottom: `1px solid ${t.line2}`,
            paddingBottom: 2,
            textDecoration: "none",
          }}
        >
          Edit
        </a>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .ec-stepbar { padding: 16px 24px !important; }
        }
      `}</style>
    </div>
  );
}

const STEPS = ["Room", "Rate & extras", "Confirm"] as const;

// 19px circles · 12px mono labels — the agreed sizing.
export function StepDots({ t, current }: { t: EditorialCalmTokens; current: 0 | 1 | 2 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 26, flexWrap: "wrap" }}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = done || i === current;
        return (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
            <span
              style={{
                width: 19,
                height: 19,
                borderRadius: 19,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: active ? t.ink : "transparent",
                color: t.paper,
                fontFamily: "var(--ec-mono)",
                fontSize: 9.5,
                boxShadow: active ? "none" : `inset 0 0 0 1px ${t.line2}`,
              }}
            >
              {done ? "✓" : ""}
            </span>
            <Mono t={t} size={12} color={active ? t.ink70 : t.ink50}>
              {s}
            </Mono>
            {i < STEPS.length - 1 && <span style={{ width: 34, height: 1, background: t.line2, marginLeft: 7 }} />}
          </span>
        );
      })}
    </div>
  );
}

// Centered page heading block used above booking screens.
export function PageHeading({
  t,
  title,
  body,
  dots,
}: {
  t: EditorialCalmTokens;
  title: string;
  body?: string;
  dots?: ReactNode;
}) {
  return (
    <div style={{ textAlign: "center", padding: "64px 40px 4px" }} className="ec-pagehead">
      <h1
        style={{
          fontFamily: "var(--ec-sans)",
          fontWeight: 400,
          fontSize: 50,
          letterSpacing: "-0.022em",
          lineHeight: 1.02,
          margin: 0,
          color: t.ink,
        }}
      >
        {title}
      </h1>
      {body && (
        <p
          style={{
            fontFamily: "var(--ec-mono)",
            fontSize: 14,
            lineHeight: 1.7,
            color: t.ink70,
            maxWidth: 480,
            margin: "18px auto 0",
          }}
        >
          {body}
        </p>
      )}
      {dots}
      <style>{`
        @media (max-width: 720px) {
          .ec-pagehead { padding: 44px 24px 4px !important; }
          .ec-pagehead h1 { font-size: 36px !important; }
        }
      `}</style>
    </div>
  );
}
