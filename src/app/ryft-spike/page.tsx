"use client";

import { useEffect, useRef, useState } from "react";

// Standalone Ryft sandbox spike. Not wired into the real checkout. Visit
// /ryft-spike, create a session, pay with a sandbox test card, and watch the
// full split-payment + 3DS flow run through Ryft's Embedded SDK.
//
// Test cards (expiry any future date, e.g. 12/30):
//   4012000000060085  Visa  — frictionless success
//   4242424242424242  Visa  — 3DS challenge (complete it in the popup)
//   4000000000001000 + CVV 222 — "do not honour" decline

const SDK_SRC = "https://embedded.ryftpay.com/v2/ryft.min.js";

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
}

export default function RyftSpikePage() {
  const [sdkReady, setSdkReady] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const split = useRef(true);

  const append = (line: string) =>
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);

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
      const ryft = (window as RyftWindow).Ryft;
      if (!ryft) throw new Error("Ryft SDK not loaded");
      ryft.init({
        publicKey: data.publicKey,
        clientSecret: data.clientSecret,
        accountId: data.accountId ?? undefined,
      });
      append("✓ Embedded SDK mounted — enter a test card and pay");
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
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ryft sandbox spike</h1>
      <p style={{ color: "#666", fontSize: 14, marginTop: 0 }}>
        £75.00 split payment → test sub-account, 10% platform fee. SDK{" "}
        {sdkReady ? "ready" : "loading…"}.
      </p>

      <button
        onClick={createSession}
        disabled={!sdkReady || busy || !!session}
        style={btnStyle(!sdkReady || busy || !!session)}
      >
        1. Create session &amp; mount card form
      </button>

      <div
        className="Ryft--paysection"
        style={{ marginTop: 24, display: session ? "block" : "none" }}
      >
        <form id="ryft-pay-form" className="Ryft--payform" onSubmit={pay}>
          <div id="ryft-pay-error" style={{ color: "#c00", fontSize: 13 }} />
          <button type="submit" id="pay-btn" disabled={busy} style={btnStyle(busy)}>
            2. Pay £75.00
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
