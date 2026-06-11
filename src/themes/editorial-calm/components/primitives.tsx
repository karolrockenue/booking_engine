"use client";

import type { CSSProperties, ReactNode, MouseEventHandler } from "react";
import type { EditorialCalmTokens } from "../tokens";

// Editorial Calm chrome. Pill buttons, mono bracketed labels, hairlines —
// straight from the export-src mockup kit, typed against the theme tokens.

// Mono bracketed label — the signature detail face.  ( SELECT DATES )
export function Bracket({
  t,
  children,
  color,
  size = 12,
  gap = 8,
  style,
}: {
  t: EditorialCalmTokens;
  children: ReactNode;
  color?: string;
  size?: number;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--ec-mono)",
        fontSize: size,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: color ?? t.ink70,
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ opacity: 0.5, marginRight: gap }}>(</span>
      {children}
      <span style={{ opacity: 0.5, marginLeft: gap }}>)</span>
    </span>
  );
}

// Plain mono caption (no brackets).
export function Mono({
  t,
  children,
  size = 11,
  color,
  tight,
  style,
}: {
  t: EditorialCalmTokens;
  children: ReactNode;
  size?: number;
  color?: string;
  tight?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--ec-mono)",
        fontSize: size,
        letterSpacing: tight ? "0.06em" : "0.12em",
        textTransform: "uppercase",
        color: color ?? t.ink50,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// Pill CTA — kinds: solid (ink bg), light (paper bg, for over-photo), outline.
export function CTA({
  t,
  children,
  kind = "solid",
  size = "md",
  onClick,
  disabled,
  style,
}: {
  t: EditorialCalmTokens;
  children: ReactNode;
  kind?: "solid" | "light" | "outline";
  size?: "sm" | "md" | "lg";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const pad = size === "lg" ? "16px 30px" : size === "sm" ? "10px 20px" : "13px 26px";
  const fs = size === "lg" ? 16 : size === "sm" ? 13.5 : 15;
  const base: CSSProperties = {
    fontFamily: "var(--ec-sans)",
    fontWeight: 500,
    fontSize: fs,
    letterSpacing: "-0.005em",
    padding: pad,
    borderRadius: 100,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    transition: "opacity .15s, background .15s",
    ...style,
  };
  if (kind === "light")
    return (
      <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, background: t.paper, color: t.ink }}>
        {children}
      </button>
    );
  if (kind === "outline")
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{ ...base, background: "transparent", color: t.ink, boxShadow: `inset 0 0 0 1px ${t.ink}` }}
      >
        {children}
      </button>
    );
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, background: t.ink, color: t.paper }}>
      {children}
    </button>
  );
}

// Quiet text link with underline — "Edit", "Change room".
export function QuietLink({
  t,
  children,
  href,
  onClick,
  style,
}: {
  t: EditorialCalmTokens;
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const s: CSSProperties = {
    fontFamily: "var(--ec-sans)",
    fontWeight: 500,
    fontSize: 13.5,
    color: t.ink,
    borderBottom: `1px solid ${t.line2}`,
    paddingBottom: 2,
    cursor: "pointer",
    background: "transparent",
    border: "none",
    borderRadius: 0,
    ...style,
  };
  if (href)
    return (
      <a href={href} style={{ ...s, borderBottom: `1px solid ${t.line2}` }}>
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} style={{ ...s, borderBottom: `1px solid ${t.line2}` }}>
      {children}
    </button>
  );
}

export function Hairline({ t, style }: { t: EditorialCalmTokens; style?: CSSProperties }) {
  return <div style={{ height: 1, background: t.line, ...style }} />;
}

// Photo slot — background-image cover div with the theme's soft radius.
export function Photo({
  src,
  alt,
  radius = 16,
  style,
  className,
}: {
  src: string;
  alt?: string;
  radius?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt ?? ""}
      className={className}
      style={{
        background: `#E7E2D6 url(${JSON.stringify(src)}) center/cover no-repeat`,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

// Underline text input — the mockups' `.field`.
export function Field({
  t,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  autoComplete,
  hint,
}: {
  t: EditorialCalmTokens;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          fontFamily: "var(--ec-sans)",
          fontWeight: 500,
          fontSize: 13,
          display: "block",
          marginBottom: 4,
          color: t.ink,
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
          fontFamily: "var(--ec-sans)",
          fontSize: 15,
          color: t.ink,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${t.line2}`,
          padding: "11px 2px",
          width: "100%",
          outline: "none",
          borderRadius: 0,
        }}
      />
      {hint && (
        <span
          style={{
            fontFamily: "var(--ec-mono)",
            fontSize: 9.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: t.ink50,
            marginTop: 6,
            display: "block",
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

export function SelectField({
  t,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  autoComplete,
}: {
  t: EditorialCalmTokens;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          fontFamily: "var(--ec-sans)",
          fontWeight: 500,
          fontSize: 13,
          display: "block",
          marginBottom: 4,
          color: t.ink,
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
          fontFamily: "var(--ec-sans)",
          fontSize: 15,
          color: value ? t.ink : t.ink50,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${t.line2}`,
          padding: "11px 2px",
          width: "100%",
          outline: "none",
          appearance: "none",
          cursor: "pointer",
          borderRadius: 0,
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

// Inline *word* → italic serif emphasis (Editorial Calm renders emphasis as
// an italic Newsreader word in the same ink — no colour change).
export function renderEm(text: string): ReactNode {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
      <em key={i} style={{ fontStyle: "italic" }}>
        {p.slice(1, -1)}
      </em>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
