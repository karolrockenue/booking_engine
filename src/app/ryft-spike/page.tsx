"use client";

import { useEffect, useRef, useState } from "react";

// Ryft sandbox demo driver. Two modes:
//   • Real booking → POST /api/ryft/booking-init: creates a booking row, a Ryft
//     pay-now session (fee split + card fee booked to the hotel), and — once you
//     pay with a test card and Ryft fires the webhook — fulfils to the PMS
//     (Cloudbeds reservation + folio payment). This is the end-to-end demo.
//   • Quick session → POST /api/ryft/session: a standalone £75 split charge with
//     no booking/PMS, for poking at the SDK in isolation.
//
// Test cards (any future expiry, any CVV):
//   4012000000060085  Visa — frictionless success
//   4242424242424242  Visa — 3DS challenge (complete it in the popup)
//   4000000000001000 + CVV 222 — "do not honour" decline

const SDK_SRC = "https://embedded.ryftpay.com/v2/ryft.min.js";
const FORM_KEY = "ryft-spike-booking-form";

interface RyftWindow extends Window {
  Ryft?: {
    init: (opts: {
      publicKey: string;
      clientSecret: string;
      accountId?: string;
    }) => void;
    attemptPayment: () => Promise<{ status?: string; lastError?: string }>;
    getUserFacingErrorMessage: (err?: string) => string;
  };
}

interface SessionInfo {
  clientSecret: string;
  paymentSessionId: string;
  accountId: string | null;
  publicKey: string;
  status: string;
  bookingId?: string;
}

interface BookingForm {
  propertyId: string;
  roomTypeId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  totalPrice: string;
  currency: string;
  guestEmail: string;
}

const EMPTY_FORM: BookingForm = {
  propertyId: "",
  roomTypeId: "",
  ratePlanId: "",
  checkIn: "",
  checkOut: "",
  totalPrice: "150.00",
  currency: "GBP",
  guestEmail: "guest@example.com",
};

// Spread the total evenly across the nights between check-in/out so the booking
// has day-rates without the operator typing each one.
function buildNightlyRates(form: BookingForm) {
  const start = new Date(form.checkIn);
  const end = new Date(form.checkOut);
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (!(nights > 0)) return { nights: 0, rates: [] as { date: string; rate: number }[] };
  const per = Number(form.totalPrice) / nights;
  const rates = Array.from({ length: nights }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return { date: d.toISOString().slice(0, 10), rate: Number(per.toFixed(2)) };
  });
  return { nights, rates };
}

export default function RyftSpikePage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [form, setForm] = useState<BookingForm>(EMPTY_FORM);
  const split = useRef(true);

  const append = (line: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORM_KEY);
      if (saved) setForm({ ...EMPTY_FORM, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    if (document.querySelector(`script[src="${SDK_SRC}"]`)) {
      setSdkReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.onload = () => setSdkReady(true);
    s.onerror = () => append("✗ failed to load Ryft SDK");
    document.head.appendChild(s);
  }, []);

  const setField = (k: keyof BookingForm, v: string) =>
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      try {
        localStorage.setItem(FORM_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  function mountSdk(data: SessionInfo) {
    const ryft = (window as RyftWindow).Ryft;
    if (!ryft) throw new Error("Ryft SDK not loaded");
    ryft.init({
      publicKey: data.publicKey,
      clientSecret: data.clientSecret,
      accountId: data.accountId ?? undefined,
    });
    append("✓ Embedded SDK mounted — enter a test card and pay");
  }

  // End-to-end: real booking → Ryft session → (after pay + webhook) Cloudbeds.
  async function createBooking() {
    const { nights, rates } = buildNightlyRates(form);
    if (nights <= 0) {
      append("✗ check-out must be after check-in");
      return;
    }
    setBusy(true);
    try {
      const orderId = `demo-${form.propertyId.slice(0, 8)}-${Date.now()}`;
      const res = await fetch("/api/ryft/booking-init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          orderId,
          roomTypeId: form.roomTypeId,
          ratePlanId: form.ratePlanId,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          adults: 2,
          children: 0,
          guestEmail: form.guestEmail,
          nightlyRates: rates,
          totalPrice: Number(form.totalPrice),
          currency: form.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "booking-init failed");
      setSession(data);
      append(
        `✓ booking ${data.bookingId} · session ${data.paymentSessionId} (${data.status})` +
          (data.accountId ? ` → hotel ${data.accountId}` : "")
      );
      mountSdk(data);
    } catch (e) {
      append(`✗ ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }

  // Standalone session, no booking/PMS.
  async function createSession() {
    setBusy(true);
    try {
      const res = await fetch("/api/ryft/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 7500, split: split.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "session create failed");
      setSession(data);
      append(
        `✓ session ${data.paymentSessionId} (${data.status})` +
          (data.accountId ? ` → sub-account ${data.accountId}` : " (no split)")
      );
      mountSdk(data);
    } catch (e) {
      append(`✗ ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    const ryft = (window as RyftWindow).Ryft;
    if (!ryft || !session) return;
    setBusy(true);
    append("→ attemptPayment()…");
    try {
      const result = await ryft.attemptPayment();
      if (result.status === "Approved" || result.status === "Captured") {
        append(`✓ PAYMENT ${result.status} — session ${session.paymentSessionId}`);
        if (session.bookingId) {
          append("→ Ryft will POST the webhook → booking fulfils to Cloudbeds");
        }
      } else {
        const msg = ryft.getUserFacingErrorMessage(result.lastError);
        append(`✗ ${result.status ?? "failed"}: ${result.lastError ?? msg}`);
      }
    } catch (err) {
      append(`✗ ${err instanceof Error ? err.message : "payment error"}`);
    } finally {
      setBusy(false);
    }
  }

  const formReady =
    form.propertyId && form.roomTypeId && form.ratePlanId && form.checkIn && form.checkOut;

  return (
    <main
      style={{
        maxWidth: 560,
        margin: "48px auto",
        padding: "0 24px",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ryft sandbox demo</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>
        Real booking → Ryft pay-now (fee split + card fee to the hotel) → on
        payment, fulfils to Cloudbeds. SDK {sdkReady ? "ready" : "loading…"}.
      </p>

      <fieldset style={fieldsetStyle} disabled={!!session}>
        <legend style={{ fontSize: 13, color: "#888", padding: "0 6px" }}>
          Booking (use your demo hotel&apos;s ids — must be an NR rate plan)
        </legend>
        {(
          [
            ["propertyId", "Property ID"],
            ["roomTypeId", "Room type ID"],
            ["ratePlanId", "Rate plan ID (NR)"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} style={labelStyle}>
            {label}
            <input
              value={form[k]}
              onChange={(e) => setField(k, e.target.value)}
              style={inputStyle}
              placeholder="uuid"
            />
          </label>
        ))}
        <div style={{ display: "flex", gap: 10 }}>
          <label style={labelStyle}>
            Check-in
            <input
              type="date"
              value={form.checkIn}
              onChange={(e) => setField("checkIn", e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Check-out
            <input
              type="date"
              value={form.checkOut}
              onChange={(e) => setField("checkOut", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label style={labelStyle}>
            Total
            <input
              value={form.totalPrice}
              onChange={(e) => setField("totalPrice", e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Currency
            <input
              value={form.currency}
              onChange={(e) => setField("currency", e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
      </fieldset>

      <button
        onClick={createBooking}
        disabled={!sdkReady || busy || !!session || !formReady}
        style={btnStyle(!sdkReady || busy || !!session || !formReady)}
      >
        1. Create booking &amp; mount card form
      </button>
      <button
        onClick={createSession}
        disabled={!sdkReady || busy || !!session}
        style={{
          ...btnStyle(!sdkReady || busy || !!session),
          background: "transparent",
          color: "#5b4cff",
          marginTop: 8,
          fontSize: 13,
        }}
      >
        or: quick £75 session (no booking)
      </button>

      <div
        className="Ryft--paysection"
        style={{ marginTop: 24, display: session ? "block" : "none" }}
      >
        <form id="ryft-pay-form" className="Ryft--payform" onSubmit={pay}>
          <div id="ryft-pay-error" style={{ color: "#c00", fontSize: 13 }} />
          <button type="submit" id="pay-btn" disabled={busy} style={btnStyle(busy)}>
            2. Pay
          </button>
        </form>
      </div>

      <pre
        style={{
          marginTop: 28,
          background: "#0d0d0d",
          color: "#d7d7d7",
          fontSize: 12.5,
          lineHeight: 1.6,
          padding: 16,
          borderRadius: 8,
          minHeight: 80,
          whiteSpace: "pre-wrap",
        }}
      >
        {log.length ? log.join("\n") : "Event log…"}
      </pre>

      <p style={{ color: "#888", fontSize: 12 }}>
        Frictionless: 4012 0000 0000 6085 · 3DS challenge: 4242 4242 4242 4242 ·
        any future expiry, any CVV.
      </p>
    </main>
  );
}

const fieldsetStyle: React.CSSProperties = {
  border: "1px solid #e3e3e3",
  borderRadius: 8,
  padding: "8px 14px 14px",
  marginTop: 16,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  fontSize: 12,
  color: "#666",
  gap: 4,
  marginTop: 10,
  flex: 1,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13,
  border: "1px solid #ccc",
  borderRadius: 6,
  fontFamily: "ui-monospace, monospace",
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    marginTop: 16,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    color: "#fff",
    background: disabled ? "#aaa" : "#5b4cff",
    border: "none",
    borderRadius: 8,
    cursor: disabled ? "default" : "pointer",
  };
}
