"use client";

import { useState } from "react";
import type { EditorialCalmTokens } from "../tokens";
import { Bracket, CTA } from "./primitives";

// "Receive 10% off your first stay" — the mockup's quiet newsletter block.
// Visual-only for now: Join confirms locally; no list backend is wired yet.

export function Newsletter({ t }: { t: EditorialCalmTokens }) {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <section style={{ padding: "84px 40px", textAlign: "center" }} className="ec-section">
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <Bracket t={t} size={11.5}>RECEIVE 10% OFF YOUR FIRST STAY</Bracket>
        <p
          style={{
            fontFamily: "var(--ec-sans)",
            fontWeight: 400,
            fontSize: 27,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            textAlign: "center",
            color: t.ink,
            margin: 0,
          }}
        >
          A little less ordinary,
          <br />
          delivered now and then.
        </p>
        {joined ? (
          <span style={{ fontFamily: "var(--ec-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: t.ink70, marginTop: 6 }}>
            <span style={{ opacity: 0.5, marginRight: 8 }}>(</span>
            LOVELY — YOU&apos;RE ON THE LIST
            <span style={{ opacity: 0.5, marginLeft: 8 }}>)</span>
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, width: "100%", maxWidth: 420, marginTop: 6 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              style={{
                flex: 1,
                fontFamily: "var(--ec-sans)",
                fontSize: 15,
                color: t.ink,
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${t.line2}`,
                padding: "11px 2px",
                outline: "none",
                borderRadius: 0,
              }}
            />
            <CTA t={t} size="sm" style={{ flexShrink: 0 }} onClick={() => email.includes("@") && setJoined(true)}>
              Join
            </CTA>
          </div>
        )}
      </div>
    </section>
  );
}
