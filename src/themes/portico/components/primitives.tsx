"use client";

import type { CSSProperties, ReactNode, MouseEventHandler } from "react";
import type { PorticoTokens } from "../tokens";

export function Btn({
  t,
  children,
  primary,
  ghost,
  onClick,
  type = "button",
  disabled,
  style,
}: {
  t: PorticoTokens;
  children: ReactNode;
  primary?: boolean;
  ghost?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    background: primary ? t.accent : ghost ? "transparent" : t.ink,
    color: primary ? t.accentInk : ghost ? t.ink : t.bg,
    border: ghost ? `1px solid ${t.ink}` : "none",
    padding: "14px 26px",
    fontSize: 10,
    letterSpacing: "0.28em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "var(--portico-sans)",
    opacity: disabled ? 0.5 : 1,
    transition: "opacity 150ms ease",
    ...style,
  };
  return (
    <button onClick={onClick} type={type} disabled={disabled} style={base}>
      {children}
    </button>
  );
}

export function Pill({
  t,
  children,
  dark,
}: {
  t: PorticoTokens;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <span
      style={{
        fontSize: 9,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        padding: "5px 10px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.25)" : t.rule}`,
        color: dark ? "rgba(255,255,255,0.85)" : t.ink,
        fontFamily: "var(--portico-sans)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Field({
  t,
  label,
  value,
  active,
  muted,
  onClick,
}: {
  t: PorticoTokens;
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
        gap: 5,
        borderBottom: active ? `1.5px solid ${t.accent}` : `1px solid ${t.rule}`,
        paddingBottom: 8,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--portico-sans)",
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: t.inkSoft,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--portico-serif)",
          fontSize: 19,
          color: muted ? t.inkSoft : t.ink,
        }}
      >
        {value}
      </span>
    </button>
  );
}

// Themed text input — used on checkout.
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
  t: PorticoTokens;
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
          fontSize: 9,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: t.inkSoft,
          fontFamily: "var(--portico-sans)",
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
          fontFamily: "var(--portico-serif)",
          fontSize: 18,
          padding: 0,
        }}
      />
    </label>
  );
}

export function Eyebrow({
  t,
  children,
  color,
}: {
  t: PorticoTokens;
  children: ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.26em",
        textTransform: "uppercase",
        color: color ?? t.inkSoft,
        fontFamily: "var(--portico-sans)",
      }}
    >
      {children}
    </div>
  );
}
