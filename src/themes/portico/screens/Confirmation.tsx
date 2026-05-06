"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  loadPersistedConfirmation,
  type PersistedConfirmation,
} from "@/lib/booking";
import type { ResolvedProperty } from "@/lib/get-property";
import type { PorticoTokens } from "../tokens";
import { porticoImg } from "../tokens";
import { PorticoShell } from "../PorticoShell";
import { Nav } from "../components/Nav";

export function PorticoConfirmation({ t, property }: { t: PorticoTokens; property: ResolvedProperty }) {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const currency = property.currency ?? "GBP";

  const [details, setDetails] = useState<PersistedConfirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPersistedConfirmation();
    if (loaded && loaded.orderId === orderId) setDetails(loaded);
    setHydrated(true);
  }, [orderId]);

  const fmt = makeFormatter(currency);
  const stayLine = details
    ? `${details.nights} ${details.nights === 1 ? "night" : "nights"}`
    : "your stay";

  return (
    <PorticoShell t={t}>
      <Nav t={t} variant="solid" />

      {/* Cinematic hero strip */}
      <section
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(280px, 38vh, 420px)",
          overflow: "hidden",
        }}
      >
        <Image
          src={porticoImg.drawingRoom}
          alt="The Portico Hotel — drawing room"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(8,15,17,0.25) 0%, rgba(8,15,17,0) 35%, rgba(8,15,17,0.65) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "48px",
            color: "#fff",
            maxWidth: 1280,
            margin: "0 auto",
          }}
          className="portico-confirmation-hero"
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              opacity: 0.9,
              marginBottom: 14,
              fontFamily: "var(--portico-sans)",
            }}
          >
            {!orderId ? "No booking found" : !hydrated ? "Confirming…" : "Reservation confirmed"}
          </div>
          <h1
            style={{
              fontFamily: "var(--portico-serif)",
              fontSize: "clamp(40px, 5.6vw, 68px)",
              lineHeight: 1.02,
              letterSpacing: "-0.018em",
              fontWeight: 400,
              margin: 0,
              maxWidth: 880,
            }}
          >
            <span style={{ fontStyle: "italic" }}>Reserved.</span>
            <br />
            {orderId
              ? `We have you for ${stayLine}.`
              : "Your reservation reference wasn't found."}
          </h1>
        </div>
      </section>

      {/* Detail body */}
      <main
        style={{
          flex: 1,
          padding: "64px 48px 80px",
          display: "flex",
          justifyContent: "center",
        }}
        className="portico-confirmation-main"
      >
        <div style={{ maxWidth: 880, width: "100%" }}>
          {!orderId ? (
            <EmptyState t={t} message="No booking reference found in the URL." />
          ) : !hydrated ? (
            <EmptyState t={t} message="Loading your reservation…" />
          ) : !details ? (
            <EmptyState
              t={t}
              message={
                <>
                  Your booking{" "}
                  <strong style={{ color: t.ink, fontVariantNumeric: "tabular-nums" }}>
                    {orderId}
                  </strong>{" "}
                  is confirmed. A receipt is on the way to your inbox.
                </>
              }
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.2fr",
                gap: 64,
                alignItems: "start",
              }}
              className="portico-confirmation-grid"
            >
              {/* Greeting + reference */}
              <div>
                <div
                  style={{
                    fontFamily: "var(--portico-sans)",
                    fontSize: 10,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    color: t.inkSoft,
                    marginBottom: 10,
                  }}
                >
                  Reference
                </div>
                <div
                  style={{
                    fontFamily: "var(--portico-serif)",
                    fontSize: 28,
                    letterSpacing: "-0.005em",
                    fontVariantNumeric: "tabular-nums",
                    margin: "0 0 24px",
                  }}
                >
                  {details.orderId}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    color: t.inkSoft,
                    lineHeight: 1.7,
                    margin: "0 0 24px",
                  }}
                >
                  Welcome, {details.firstName}. A confirmation is on its way to{" "}
                  <span style={{ color: t.ink }}>{details.email}</span>. Reception is staffed
                  twenty-four hours; just buzz the porch when you arrive.
                </p>
                <p
                  style={{
                    fontFamily: "var(--portico-serif)",
                    fontStyle: "italic",
                    fontSize: 18,
                    color: t.ink,
                    lineHeight: 1.5,
                    margin: 0,
                    paddingTop: 20,
                    borderTop: `1px solid ${t.rule}`,
                  }}
                >
                  &ldquo;A jewel-box behind a Paddington portico.&rdquo;
                </p>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    opacity: 0.7,
                    marginTop: 8,
                    fontFamily: "var(--portico-sans)",
                  }}
                >
                  — Conde Nast Traveller
                </div>
              </div>

              {/* Detail rows */}
              <div
                style={{
                  borderTop: `1px solid ${t.rule}`,
                  borderBottom: `1px solid ${t.rule}`,
                  padding: "8px 0",
                }}
              >
                <SumLine t={t} label="Guest" value={`${details.firstName} ${details.lastName}`} />
                <SumLine t={t} label="Room" value={`${details.roomName} · ${details.rateName}`} />
                <SumLine t={t} label="Arrive" value={fmtDate(details.checkIn, "EEE d MMM yyyy · 'from 4pm'")} />
                <SumLine t={t} label="Depart" value={fmtDate(details.checkOut, "EEE d MMM yyyy · 'by 11am'")} />
                <SumLine
                  t={t}
                  label="Guests"
                  value={`${details.adults} ${details.adults === 1 ? "adult" : "adults"}`}
                />
                {details.extras && details.extras.length > 0 && (
                  <SumLine
                    t={t}
                    label="Extras"
                    value={details.extras.map((e) => e.name).join(" · ")}
                  />
                )}
                <SumLine t={t} label="Total" value={fmt.format(details.totalPrice)} emphasis />
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 24,
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: 48,
              paddingTop: 24,
              borderTop: `1px solid ${t.rule}`,
            }}
          >
            <Link
              href="/"
              style={{
                background: t.ink,
                color: t.bg,
                padding: "14px 26px",
                fontSize: 10,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                textDecoration: "none",
                fontFamily: "var(--portico-sans)",
              }}
            >
              Return home
            </Link>
            <Link
              href="/#good-to-know"
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: t.accent,
                textDecoration: "none",
                borderBottom: `1px solid ${t.accent}`,
                paddingBottom: 2,
                fontFamily: "var(--portico-sans)",
              }}
            >
              Good to know
            </Link>
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: t.inkSoft,
                fontFamily: "var(--portico-sans)",
                marginLeft: "auto",
              }}
            >
              {property.name}
            </span>
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 720px) {
          .portico-confirmation-hero { padding: 28px !important; }
          .portico-confirmation-main { padding: 40px 24px 56px !important; }
          .portico-confirmation-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
      `}</style>
    </PorticoShell>
  );
}

function EmptyState({ t, message }: { t: PorticoTokens; message: React.ReactNode }) {
  return (
    <p
      style={{
        color: t.inkSoft,
        fontSize: 15,
        lineHeight: 1.7,
        padding: "24px 0",
        borderTop: `1px solid ${t.rule}`,
        borderBottom: `1px solid ${t.rule}`,
        margin: 0,
      }}
    >
      {message}
    </p>
  );
}

function SumLine({
  t,
  label,
  value,
  emphasis,
}: {
  t: PorticoTokens;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: `1px solid ${t.rule}`,
        gap: 16,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: t.inkSoft,
          fontFamily: "var(--portico-sans)",
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasis ? 22 : 14,
          fontVariantNumeric: "tabular-nums",
          fontFamily: emphasis ? "var(--portico-sans)" : "var(--portico-serif)",
          fontWeight: emphasis ? 500 : 400,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function fmtDate(iso: string, pattern: string): string {
  try {
    return format(parseISO(iso), pattern);
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
