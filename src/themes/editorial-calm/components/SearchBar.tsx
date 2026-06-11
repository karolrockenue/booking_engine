"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EditorialCalmTokens } from "../tokens";
import { CTA } from "./primitives";
import { DatePicker, fmtShort, toIsoDate, nightsBetween } from "./DatePicker";

// The C1 "Editorial" hero booking form, faithful to main.html:
// LOCATION · DATES · GUESTS underline fields over the photo, Search →,
// the "( REDEEM A VOUCHER )" secondary link, and the STAYING LONGER? pill
// that opens the long-stay enquiry panel. Routes to /<slug>/rooms.

type Panel = null | "location" | "dates" | "guests" | "voucher" | "longstay";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const STAY_LENGTHS = ["One month", "Two months", "Three months +"];

export function HeroSearchBar({
  t,
  slug,
  propertyName,
  enquiriesEmail,
}: {
  t: EditorialCalmTokens;
  slug: string;
  propertyName: string;
  enquiriesEmail?: string;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [voucher, setVoucher] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!panel) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPanel(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [panel]);

  const nights = nightsBetween(checkIn, checkOut);
  const datesVal =
    checkIn && checkOut
      ? `${fmtShort(checkIn)} – ${fmtShort(checkOut)}`
      : checkIn
        ? `${fmtShort(checkIn)} – …`
        : "Add dates";
  const guestsVal = `${adults} adult${adults > 1 ? "s" : ""}${children ? ` · ${children} kid${children > 1 ? "s" : ""}` : ""}`;

  const toggle = (p: Panel) => setPanel(panel === p ? null : p);

  function submit() {
    if (!checkIn || !checkOut) {
      setPanel("dates");
      return;
    }
    const params = new URLSearchParams({
      checkIn: toIsoDate(checkIn),
      checkOut: toIsoDate(checkOut),
      adults: String(adults),
      children: String(children),
    });
    if (voucher) params.set("voucher", voucher);
    router.push(`/${slug}/rooms?${params.toString()}`);
  }

  return (
    <div ref={rootRef} id="stay-search" style={{ position: "relative", margin: "40px auto 0", width: "fit-content", maxWidth: "100%", zIndex: 16 }}>
      {/* fields + popovers share a relative wrapper so popovers anchor right
          under the field row (above the voucher link), as in the mockup */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 32, justifyContent: "center", flexWrap: "wrap" }} className="ec-search-row">
          <Trigger
            label="LOCATION"
            value={propertyName}
            minWidth={220}
            active={panel === "location"}
            onClick={() => toggle("location")}
          />
          <Trigger
            label="DATES"
            value={datesVal}
            sub={nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : undefined}
            active={panel === "dates"}
            onClick={() => toggle("dates")}
          />
          <Trigger
            label="GUESTS"
            value={guestsVal}
            active={panel === "guests"}
            onClick={() => toggle("guests")}
          />
          <CTA t={t} kind="light" size="md" style={{ height: 50 }} onClick={submit}>
            Search →
          </CTA>
        </div>

        {panel === "location" && (
          <PopCard t={t} width={300} align="left">
            <button
              type="button"
              onClick={() => setPanel(null)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                border: "none",
                background: t.line,
                borderRadius: 10,
                padding: "11px 12px",
                fontFamily: "var(--ec-sans)",
                fontWeight: 500,
                fontSize: 15,
                color: t.ink,
              }}
            >
              {propertyName}
            </button>
            <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, marginTop: 12 }}>
              ONE HOUSE, FOR NOW
            </div>
          </PopCard>
        )}

        {panel === "dates" && (
          <PopCard t={t} wide>
            <DatePicker
              t={t}
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(ci, co) => {
                setCheckIn(ci);
                setCheckOut(co);
              }}
            />
            {checkIn && checkOut && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                <CTA t={t} size="sm" onClick={() => setPanel(null)}>
                  Done
                </CTA>
              </div>
            )}
          </PopCard>
        )}

        {panel === "guests" && (
          <PopCard t={t}>
            {(
              [
                ["Adults", adults, setAdults, "AGE 18+", 1, 6],
                ["Children", children, setChildren, "AGES 0–17", 0, 4],
              ] as const
            ).map(([label, n, set, hint, min, max], idx) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderBottom: idx === 0 ? `1px solid ${t.line}` : "none",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 15 }}>{label}</div>
                  <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.14em", color: t.ink50, marginTop: 2 }}>{hint}</div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
                  <StepBtn t={t} onClick={() => set(Math.max(min, n - 1))} disabled={n <= min}>−</StepBtn>
                  <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 16, minWidth: 16, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{n}</span>
                  <StepBtn t={t} onClick={() => set(Math.min(max, n + 1))} disabled={n >= max}>+</StepBtn>
                </span>
              </div>
            ))}
            <CTA t={t} size="sm" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={() => setPanel(null)}>
              Done
            </CTA>
          </PopCard>
        )}

        {panel === "voucher" && (
          <VoucherPanel t={t} initial={voucher} onApply={(v) => { setVoucher(v); setPanel(null); }} />
        )}
      </div>

      {/* secondary voucher link — white, on the photo */}
      <div style={{ display: "flex", gap: 26, justifyContent: "center", marginTop: 22 }}>
        <button
          type="button"
          onClick={() => toggle("voucher")}
          style={{
            background: "transparent",
            cursor: "pointer",
            border: "none",
            fontFamily: "var(--ec-mono)",
            fontSize: 10.5,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: voucher ? "#fff" : "rgba(255,255,255,.72)",
            borderBottom: `1px solid rgba(255,255,255,${voucher ? 0.8 : 0.4})`,
            paddingBottom: 3,
            borderRadius: 0,
          }}
        >
          {voucher ? `( VOUCHER · ${voucher.toUpperCase()} )` : "( REDEEM A VOUCHER )"}
        </button>
      </div>

      {/* "staying longer?" — opens the long-stay panel, as wide as the booking row */}
      <div style={{ marginTop: 44, position: "relative" }}>
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            onClick={() => toggle("longstay")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              background: t.paper,
              border: "none",
              borderRadius: 100,
              padding: "7px 8px 7px 22px",
              boxShadow: panel === "longstay" ? "0 0 0 2px rgba(255,255,255,.7)" : "0 12px 30px -16px rgba(0,0,0,.55)",
              transition: "box-shadow .15s",
            }}
          >
            <span style={{ fontFamily: "var(--ec-mono)", fontSize: 12.5, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink }}>
              STAYING LONGER?
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 100, background: t.ink, color: t.paper, fontSize: 14 }}>
              →
            </span>
          </button>
        </div>
        {panel === "longstay" && (
          <div style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 14, zIndex: 20 }}>
            <LongStayPanel t={t} propertyName={propertyName} enquiriesEmail={enquiriesEmail} />
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .ec-search-row { gap: 20px !important; }
        }
      `}</style>
    </div>
  );
}

// The SL3 long-stay panel — arrival month + length of stay, enquiry CTAs.
// Until a residency flow exists in the engine, both actions open a
// pre-filled enquiry email to the property.
function LongStayPanel({
  t,
  propertyName,
  enquiriesEmail,
}: {
  t: EditorialCalmTokens;
  propertyName: string;
  enquiriesEmail?: string;
}) {
  const now = new Date();
  const [monthIdx, setMonthIdx] = useState(0); // offset from current month
  const [len, setLen] = useState(STAY_LENGTHS[2]);
  const [monthsOpen, setMonthsOpen] = useState(false);

  const monthLabel = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const subject = encodeURIComponent(`Long stay enquiry — ${propertyName}`);
  const body = encodeURIComponent(
    `Hello,\n\nI'm interested in a longer stay at ${propertyName}.\nArriving around: ${monthLabel(monthIdx)}\nLength of stay: ${len}\n\nThanks!`
  );
  const mailtoHref = `mailto:${enquiriesEmail ?? ""}?subject=${subject}&body=${body}`;

  const chip = (on: boolean) =>
    ({
      fontFamily: "var(--ec-sans)",
      fontWeight: 500,
      fontSize: 12.5,
      padding: "9px 15px",
      borderRadius: 100,
      cursor: "pointer",
      border: "none",
      background: on ? "#D3E1D3" : "transparent",
      color: t.ink,
      boxShadow: on ? "inset 0 0 0 1px #9DBFA4" : `inset 0 0 0 1px ${t.line}`,
    }) as const;

  return (
    <div
      style={{
        background: t.paper,
        borderRadius: 18,
        color: t.ink,
        textAlign: "left",
        boxShadow: "0 40px 90px -36px rgba(20,22,16,.7)",
        border: `1px solid ${t.line}`,
        width: "100%",
        padding: 22,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 30, flex: 1, minWidth: 340, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: t.ink50, marginBottom: 10 }}>
              ARRIVING AROUND
            </div>
            <button
              type="button"
              onClick={() => setMonthsOpen((o) => !o)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--ec-sans)",
                fontWeight: 600,
                fontSize: 22,
                color: t.ink,
                borderBottom: "2px solid #9DBFA4",
                paddingBottom: 4,
                borderRadius: 0,
              }}
            >
              {monthLabel(monthIdx)} <span style={{ color: t.ink50, fontSize: 15 }}>▾</span>
            </button>
            {monthsOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 10,
                  zIndex: 30,
                  background: t.paper,
                  border: `1px solid ${t.line}`,
                  borderRadius: 14,
                  boxShadow: "0 24px 60px -28px rgba(20,22,16,.6)",
                  padding: 10,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  minWidth: 280,
                }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setMonthIdx(i);
                      setMonthsOpen(false);
                    }}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      border: "none",
                      background: i === monthIdx ? t.line : "transparent",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontFamily: "var(--ec-sans)",
                      fontWeight: 500,
                      fontSize: 13,
                      color: t.ink,
                    }}
                  >
                    {monthLabel(i)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: t.ink50, marginBottom: 10 }}>
              LENGTH OF STAY
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STAY_LENGTHS.map((l) => (
                <button key={l} type="button" onClick={() => setLen(l)} style={chip(len === l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, minWidth: 188 }}>
          <a
            href={mailtoHref}
            style={{
              cursor: "pointer",
              background: "transparent",
              color: t.ink,
              fontFamily: "var(--ec-sans)",
              fontWeight: 500,
              fontSize: 13.5,
              padding: "12px 22px",
              borderRadius: 100,
              boxShadow: "inset 0 0 0 1px #9DBFA4",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Book a viewing
          </a>
          <a
            href={mailtoHref}
            style={{
              cursor: "pointer",
              background: "#D3E1D3",
              color: t.ink,
              fontFamily: "var(--ec-sans)",
              fontWeight: 600,
              fontSize: 15,
              padding: "14px 24px",
              borderRadius: 100,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Enquire now →
          </a>
        </div>
      </div>
    </div>
  );
}

function VoucherPanel({
  t,
  initial,
  onApply,
}: {
  t: EditorialCalmTokens;
  initial: string;
  onApply: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <PopCard t={t}>
      <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: t.ink50, marginBottom: 12 }}>
        GIFT OR DISCOUNT VOUCHER
      </div>
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Enter code"
        style={{
          width: "100%",
          fontFamily: "var(--ec-sans)",
          fontSize: 15,
          padding: "10px 2px",
          border: "none",
          borderBottom: `1px solid ${t.line2}`,
          outline: "none",
          background: "transparent",
          color: t.ink,
          borderRadius: 0,
        }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <CTA t={t} size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onApply(v.trim())}>
          Apply
        </CTA>
        <CTA t={t} kind="outline" size="sm" onClick={() => onApply("")}>
          Clear
        </CTA>
      </div>
    </PopCard>
  );
}

function Trigger({
  label,
  value,
  sub,
  onClick,
  active,
  minWidth = 150,
}: {
  label: string;
  value: string;
  sub?: string;
  onClick: () => void;
  active: boolean;
  minWidth?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "transparent",
        cursor: "pointer",
        border: "none",
        borderBottom: `1px solid rgba(255,255,255,${active ? 0.95 : 0.55})`,
        paddingBottom: 9,
        minWidth,
        whiteSpace: "nowrap",
        borderRadius: 0,
      }}
    >
      <span
        style={{
          display: "block",
          fontFamily: "var(--ec-mono)",
          fontSize: 9.5,
          letterSpacing: "0.16em",
          color: "rgba(255,255,255,.7)",
          marginBottom: 9,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "var(--ec-sans)", fontWeight: 500, fontSize: 17, color: "#fff" }}>{value}</span>
      {sub && (
        <span style={{ display: "block", fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(255,255,255,.6)", marginTop: 5, textTransform: "uppercase" }}>
          {sub}
        </span>
      )}
    </button>
  );
}

function PopCard({
  t,
  children,
  wide,
  width,
  align = "center",
}: {
  t: EditorialCalmTokens;
  children: React.ReactNode;
  wide?: boolean;
  width?: number;
  align?: "center" | "left";
}) {
  // anchored to the field-row wrapper: "left" sits under the first field
  // (LOCATION), "center" under the middle of the row (dates / guests)
  const pos =
    align === "left"
      ? { left: 0 }
      : { left: "50%", transform: "translateX(-50%)" };
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        marginTop: 18,
        zIndex: 20,
        width: wide ? "min(680px, 92vw)" : (width ?? 340),
        maxWidth: "92vw",
        ...pos,
      }}
    >
      <div
        style={{
          background: t.paper,
          borderRadius: 18,
          color: t.ink,
          textAlign: "left",
          boxShadow: "0 40px 90px -36px rgba(20,22,16,.7)",
          border: `1px solid ${t.line}`,
          padding: 24,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function StepBtn({
  t,
  onClick,
  disabled,
  children,
}: {
  t: EditorialCalmTokens;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 30,
        height: 30,
        borderRadius: 30,
        fontSize: 17,
        cursor: disabled ? "default" : "pointer",
        background: "transparent",
        border: "none",
        boxShadow: `inset 0 0 0 1px ${t.line2}`,
        color: disabled ? t.line2 : t.ink,
      }}
    >
      {children}
    </button>
  );
}
