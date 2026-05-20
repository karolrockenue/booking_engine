"use client";

import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { BookingNav } from "../components/Nav";
import { Field } from "../components/primitives";
import { Btn } from "../components/primitives";
import { PorticoCalendar } from "../components/Calendar";

export function PorticoDates({ t, currency }: { t: PorticoTokens; currency: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = useParams<{ property: string }>().property ?? "";

  const initial = useMemo(() => {
    const ci = searchParams.get("checkIn");
    const co = searchParams.get("checkOut");
    return {
      arrival: ci ? safeParse(ci) : null,
      departure: co ? safeParse(co) : null,
      adults: parseInt(searchParams.get("adults") ?? "2", 10),
      children: parseInt(searchParams.get("children") ?? "0", 10),
    };
  }, [searchParams]);

  const [arrival, setArrival] = useState<Date | null>(initial.arrival);
  const [departure, setDeparture] = useState<Date | null>(initial.departure);
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [activeField, setActiveField] = useState<"arrive" | "depart" | "guests">("arrive");

  const nights = arrival && departure ? Math.max(0, differenceInCalendarDays(departure, arrival)) : 0;

  const canContinue = Boolean(arrival && departure && nights >= 1);

  function handleContinue() {
    if (!arrival || !departure) return;
    const params = new URLSearchParams({
      checkIn: format(arrival, "yyyy-MM-dd"),
      checkOut: format(departure, "yyyy-MM-dd"),
      adults: adults.toString(),
      children: children.toString(),
      rooms: "1",
    });
    router.push(`/${slug}/rooms?${params.toString()}`);
  }

  return (
    <PorticoShell t={t}>
      <BookingNav t={t} step={0} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.05fr",
          flex: 1,
          minHeight: "calc(100dvh - 60px)",
        }}
        className="portico-dates-grid"
      >
        {/* Left pane — image */}
        <aside style={{ position: "relative", overflow: "hidden", minHeight: 360 }}>
          <Image
            src={porticoImg.bookSidePane}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45))",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 48,
              bottom: 48,
              color: "#fff",
              maxWidth: 380,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                opacity: 0.85,
                marginBottom: 14,
                fontFamily: "var(--portico-sans)",
              }}
            >
              Begin your stay
            </div>
            <div
              style={{
                fontFamily: "var(--portico-serif)",
                fontSize: 40,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
              }}
            >
              Choose your <span style={{ fontStyle: "italic" }}>nights</span> with us.
            </div>
          </div>
        </aside>

        {/* Right pane — form */}
        <section
          style={{
            padding: "48px 56px",
            background: t.bg2,
            overflow: "auto",
          }}
          className="portico-dates-form"
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: t.inkSoft,
              marginBottom: 10,
            }}
          >
            Step 01
          </div>
          <h1
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: 34,
              margin: "0 0 32px",
              letterSpacing: "-0.01em",
              fontWeight: 400,
            }}
          >
            When &amp; who
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 22,
              marginBottom: 28,
            }}
          >
            <Field
              t={t}
              label="Arrive"
              value={arrival ? format(arrival, "EEE d MMM yyyy") : "Select a date"}
              active={activeField === "arrive"}
              muted={!arrival}
              onClick={() => setActiveField("arrive")}
            />
            <Field
              t={t}
              label="Depart"
              value={departure ? format(departure, "EEE d MMM yyyy") : "Select a date"}
              active={activeField === "depart"}
              muted={!departure}
              onClick={() => setActiveField("depart")}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 22,
              marginBottom: 32,
              alignItems: "end",
            }}
          >
            <GuestStepper
              t={t}
              label="Adults"
              value={adults}
              min={1}
              max={6}
              onChange={setAdults}
            />
            <GuestStepper
              t={t}
              label="Children"
              value={children}
              min={0}
              max={4}
              onChange={setChildren}
            />
          </div>

          <div style={{ borderTop: `1px solid ${t.rule}`, paddingTop: 22 }}>
            <PorticoCalendar
              t={t}
              arrival={arrival}
              departure={departure}
              onSelect={(next) => {
                setArrival(next.arrival);
                setDeparture(next.departure);
                setActiveField(next.arrival && !next.departure ? "depart" : "arrive");
              }}
            />
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: `1px solid ${t.rule}`,
              paddingTop: 22,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: t.inkSoft,
                  fontFamily: "var(--portico-sans)",
                }}
              >
                {nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : "Select dates"}
              </div>
            </div>
            <Btn t={t} primary onClick={handleContinue} disabled={!canContinue}>
              See rooms →
            </Btn>
          </div>

          <div style={{ marginTop: 18, fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: t.inkSoft }}>
            Currency · {currency}
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .portico-dates-grid {
            grid-template-columns: 1fr !important;
          }
          .portico-dates-form {
            padding: 32px 24px !important;
          }
        }
      `}</style>
    </PorticoShell>
  );
}

function GuestStepper({
  t,
  label,
  value,
  min,
  max,
  onChange,
}: {
  t: PorticoTokens;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${t.rule}`,
        paddingBottom: 8,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: t.inkSoft,
          marginBottom: 5,
          fontFamily: "var(--portico-sans)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontFamily: "var(--portico-serif)",
            fontSize: 19,
            color: t.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <CountBtn t={t} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</CountBtn>
          <CountBtn t={t} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</CountBtn>
        </div>
      </div>
    </div>
  );
}

function CountBtn({
  t,
  onClick,
  disabled,
  children,
}: {
  t: PorticoTokens;
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
        width: 26,
        height: 26,
        borderRadius: 0,
        background: "transparent",
        color: disabled ? t.inkSoft : t.ink,
        border: `1px solid ${disabled ? t.rule : t.ink}`,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--portico-sans)",
        fontSize: 14,
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function safeParse(s: string): Date | null {
  try {
    const d = parseISO(s);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
