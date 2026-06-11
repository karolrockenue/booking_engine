"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { loadPersistedConfirmation, type PersistedConfirmation } from "@/lib/booking";
import type { ResolvedProperty } from "@/lib/get-property";
import type { EditorialCalmTokens } from "../tokens";
import { EditorialCalmShell } from "../EditorialCalmShell";
import { Nav } from "../components/Nav";
import { CTA, Mono, Bracket } from "../components/primitives";
import { FineFooter } from "./RoomSelect";

// Confirmation — calm, card-led. Green tick, reference boxes, stay details.
// Visual language ported from the Phase-2 finalising mock (confirmed state);
// the async finalising/poll states arrive with the robust-fulfilment work.

export function EditorialCalmConfirmation({
  t,
  property,
}: {
  t: EditorialCalmTokens;
  property: ResolvedProperty;
}) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const currency = property.currency ?? "GBP";

  const [details, setDetails] = useState<PersistedConfirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPersistedConfirmation();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (loaded && loaded.orderId === orderId) setDetails(loaded);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [orderId]);

  const fmt = makeFormatter(currency);

  return (
    <EditorialCalmShell t={t}>
      <Nav t={t} name={property.name} />

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "64px 24px 96px", width: "100%" }}>
        {!orderId ? (
          <Empty t={t} slug={property.slug} message="No booking reference found in the URL." />
        ) : !hydrated ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Mono t={t} size={11}>LOADING YOUR RESERVATION…</Mono>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 46,
                  background: t.forest,
                  margin: "0 auto 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <h1
                style={{
                  fontFamily: "var(--ec-serif)",
                  fontWeight: 400,
                  fontSize: 38,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.08,
                  margin: "0 0 14px",
                  color: t.ink,
                }}
              >
                {details?.firstName ? `Thank you, ${details.firstName}.` : "Booking confirmed."}
              </h1>
              <p style={{ fontFamily: "var(--ec-mono)", fontSize: 14, lineHeight: 1.7, color: t.ink70, maxWidth: 430, margin: "0 auto" }}>
                Your reservation is confirmed. We look forward to welcoming you to {property.name}.
              </p>
            </div>

            {/* reference boxes */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", margin: "32px 0 0" }}>
              {details?.cloudbedsReservationId && (
                <RefBox t={t} k="RESERVATION NUMBER" v={details.cloudbedsReservationId} strong />
              )}
              <RefBox t={t} k="ORDER ID" v={shortRef(orderId)} />
            </div>

            {details?.email && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 }}>
                <Mono t={t} size={10.5} tight>
                  CONFIRMATION SENT TO <span style={{ color: t.ink }}>{details.email.toUpperCase()}</span>
                </Mono>
              </div>
            )}

            {/* stay details card */}
            {details && (
              <div style={{ border: `1px solid ${t.line}`, borderRadius: 20, overflow: "hidden", background: t.paper, marginTop: 36 }}>
                <div style={{ padding: "16px 22px", borderBottom: `1px solid ${t.line}` }}>
                  <Bracket t={t} size={10.5}>STAY DETAILS</Bracket>
                </div>
                <div style={{ padding: "8px 22px 10px" }}>
                  <SumLine t={t} label="Guest" value={`${details.firstName} ${details.lastName}`} />
                  <SumLine t={t} label="Room" value={`${details.roomName} · ${details.rateName}`} />
                  <SumLine t={t} label="Arrive" value={fmtDate(details.checkIn)} />
                  <SumLine t={t} label="Depart" value={fmtDate(details.checkOut)} />
                  <SumLine t={t} label="Guests" value={`${details.adults} ${details.adults === 1 ? "adult" : "adults"}`} />
                  <SumLine t={t} label="Accommodation" value={fmt.format(details.roomTotal)} />
                  {details.extras?.map((e, i) => (
                    <SumLine key={`${e.name}-${i}`} t={t} label={e.quantity > 1 ? `${e.name} × ${e.quantity}` : e.name} value={fmt.format(e.lineTotal)} />
                  ))}
                  <SumLine
                    t={t}
                    label={details.rateType === "nr" ? "Total · charged today" : "Total · due at stay"}
                    value={fmt.format(details.totalPrice)}
                    emphasis
                  />
                </div>
              </div>
            )}

            {!details && (
              <p
                style={{
                  fontFamily: "var(--ec-mono)",
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: t.ink70,
                  textAlign: "center",
                  marginTop: 32,
                  padding: "20px 0",
                  borderTop: `1px solid ${t.line}`,
                  borderBottom: `1px solid ${t.line}`,
                }}
              >
                Your booking <b style={{ color: t.ink }}>{shortRef(orderId)}</b> is confirmed. A receipt is on the way to your inbox.
              </p>
            )}

            <div style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginTop: 40 }}>
              <Link href={`/${property.slug}`} style={{ textDecoration: "none" }}>
                <CTA t={t} kind="outline" size="md">Return to homepage</CTA>
              </Link>
              {details?.cancelUrl && (
                <a
                  href={details.cancelUrl}
                  style={{
                    fontFamily: "var(--ec-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: t.ink50,
                    borderBottom: `1px solid ${t.line2}`,
                    paddingBottom: 2,
                    textDecoration: "none",
                  }}
                >
                  Cancel booking
                </a>
              )}
            </div>
          </>
        )}
      </div>

      <FineFooter t={t} name={property.name} />
    </EditorialCalmShell>
  );
}

function RefBox({ t, k, v, strong }: { t: EditorialCalmTokens; k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ background: "#F1EEE6", borderRadius: 10, padding: "13px 20px", textAlign: "left", minWidth: 190 }}>
      <div style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, marginBottom: 5 }}>{k}</div>
      <div style={{ fontFamily: "var(--ec-mono)", fontSize: strong ? 18 : 13, fontWeight: strong ? 700 : 400, color: t.ink }}>{v}</div>
    </div>
  );
}

function SumLine({
  t,
  label,
  value,
  emphasis,
}: {
  t: EditorialCalmTokens;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 16,
        padding: "13px 0",
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <span style={{ fontFamily: "var(--ec-mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: t.ink50, flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--ec-sans)",
          fontWeight: emphasis ? 600 : 500,
          fontSize: emphasis ? 22 : 14.5,
          letterSpacing: emphasis ? "-0.02em" : "0",
          fontVariantNumeric: "tabular-nums",
          color: t.ink,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Empty({ t, slug, message }: { t: EditorialCalmTokens; slug: string; message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <p style={{ fontFamily: "var(--ec-mono)", fontSize: 14, color: t.ink70, marginBottom: 24 }}>{message}</p>
      <Link href={`/${slug}`} style={{ textDecoration: "none" }}>
        <CTA t={t} kind="outline" size="md">Return to homepage</CTA>
      </Link>
    </div>
  );
}

function shortRef(orderId: string): string {
  return orderId.length > 18 ? `${orderId.slice(0, 13)}…` : orderId;
}

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "EEE d MMM yyyy");
  } catch {
    return iso;
  }
}

function makeFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  }
}
