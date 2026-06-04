"use client";

import type { CSSProperties, ReactNode, MouseEventHandler } from "react";
import type { StreetTokens } from "../tokens";

// Street's chrome is intentionally austere: no solid CTAs by default — every
// action is a ghost-bordered button in ink. The ".filled" variant exists for
// cases where we need a louder CTA (sticky bars, payment confirm).

export function Btn({
  t,
  children,
  filled,
  onClick,
  type = "button",
  disabled,
  style,
}: {
  t: StreetTokens;
  children: ReactNode;
  filled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    background: filled ? t.ink : "transparent",
    color: filled ? t.bg : t.ink,
    border: `1px solid ${t.ink}`,
    padding: "13px 26px",
    fontSize: 11.5,
    fontWeight: 500,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--street-sans)",
    opacity: disabled ? 0.45 : 1,
    transition: "background 140ms ease, color 140ms ease",
    ...style,
  };
  return (
    <button onClick={onClick} type={type} disabled={disabled} style={base}>
      {children}
    </button>
  );
}

// Click-to-open underline "field" used in search bars and dates pickers.
// Serif value, sans uppercase label, underlined by a hairline.
export function Field({
  t,
  label,
  value,
  active,
  muted,
  onClick,
}: {
  t: StreetTokens;
  label: string;
  value: ReactNode;
  active?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderBottom: active ? `1.5px solid ${t.ink}` : `1px solid ${t.rule}`,
        paddingBottom: 8,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--street-sans)",
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--street-serif)",
          fontSize: 20,
          letterSpacing: "-0.005em",
          color: muted ? t.inkMuted : t.ink,
        }}
      >
        {value}
      </span>
    </button>
  );
}

// Themed text input — used on checkout (M6).
export function Input({
  t,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoComplete,
}: {
  t: StreetTokens;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderBottom: `1px solid ${t.rule}`,
        paddingBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontWeight: 500,
          fontFamily: "var(--street-sans)",
        }}
      >
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          color: t.ink,
          fontFamily: "var(--street-serif)",
          fontSize: 18,
          padding: 0,
        }}
      />
    </label>
  );
}

export function Select({
  t,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  autoComplete,
}: {
  t: StreetTokens;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        borderBottom: `1px solid ${t.rule}`,
        paddingBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: t.inkMuted,
          fontWeight: 500,
          fontFamily: "var(--street-sans)",
        }}
      >
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          color: value ? t.ink : t.inkMuted,
          fontFamily: "var(--street-serif)",
          fontSize: 18,
          padding: 0,
          appearance: "none",
          cursor: "pointer",
        }}
      >
        <option value="" disabled>
          {placeholder ?? "Select…"}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Eyebrow({
  t,
  children,
  color,
}: {
  t: StreetTokens;
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color: color ?? t.inkMuted,
        fontFamily: "var(--street-sans)",
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}

// Serif headline with italic-accent rendering — pass copy with *word* markup
// to get the gold italic accent on those words. Pairs with renderEmphasis.
export function SerifH({
  t,
  children,
  size = "lg",
  style,
}: {
  t: StreetTokens;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  style?: CSSProperties;
}) {
  const sizes = { sm: 28, md: 36, lg: 48, xl: 64 };
  return (
    <h1
      style={{
        fontFamily: "var(--street-serif)",
        fontWeight: 400,
        fontSize: sizes[size],
        lineHeight: 1.08,
        letterSpacing: "-0.02em",
        color: t.ink,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

export function Hairline({ t, style }: { t: StreetTokens; style?: CSSProperties }) {
  return (
    <div
      style={{
        height: 1,
        background: t.rule,
        width: "100%",
        ...style,
      }}
    />
  );
}
