// Rockenue Tech platform landing page — shown on the bare platform host
// (app.rockenue.tech). Brand: dark #14181D, teal "(" + gold ")" motif, Inter
// light. Theme-agnostic (rendered directly, not via the hotel themes). The
// Admin button (top-right) is the entry to the webmaster admin area.

import { Wordmark } from "./Wordmark";

const BG = "#14181D";
const INK = "#F4F2EC";
const MUTED = "#8A9099";
const TEAL = "#38C6BA";
const GOLD = "#C8A66E";
const HAIR = "rgba(255,255,255,0.08)";

const FEATURES: Array<[string, string]> = [
  ["Conversion-first", "Booking pages built to win the direct booking — not a widget bolted onto a website."],
  ["Real-time sync", "Live rooms, rates and extras from the hotel's PMS, always accurate."],
  ["Direct payouts", "Ryft settles each booking straight to the hotel's own account."],
];

export function RockenueLanding() {
  return (
    <div
      style={{
        minHeight: "100svh",
        background: BG,
        color: INK,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "20px clamp(20px, 5vw, 56px)",
        }}
      >
        <Wordmark variant="dark" size="md" />
        <a
          href="/admin"
          style={{
            marginLeft: "auto",
            fontSize: 13,
            color: INK,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 7,
            padding: "8px 17px",
            fontWeight: 400,
          }}
        >
          Admin →
        </a>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px clamp(20px, 5vw, 56px)",
          maxWidth: 1000,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.24em",
            color: TEAL,
            textTransform: "uppercase",
            marginBottom: 26,
          }}
        >
          Rockenue Tech
        </div>
        <h1
          style={{
            fontSize: "clamp(34px, 6vw, 64px)",
            fontWeight: 300,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            margin: 0,
            maxWidth: 900,
          }}
        >
          Direct booking technology for independent hotels.
        </h1>
        <p
          style={{
            fontSize: "clamp(15px, 2.2vw, 19px)",
            lineHeight: 1.6,
            color: MUTED,
            marginTop: 28,
            maxWidth: 640,
            fontWeight: 300,
          }}
        >
          We design and run bespoke booking engines for the hotels Rockenue
          manages — each on the hotel&rsquo;s own brand and domain. Own your
          traffic, keep your margin.
        </p>

        <div
          style={{
            display: "flex",
            gap: "clamp(20px, 4vw, 44px)",
            marginTop: 52,
            flexWrap: "wrap",
          }}
        >
          {FEATURES.map(([title, desc]) => (
            <div key={title} style={{ flex: "1 1 220px", maxWidth: 290 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 7 }}>
                <span style={{ color: GOLD, marginRight: 8 }}>—</span>
                {title}
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: MUTED,
                  fontWeight: 300,
                }}
              >
                {desc}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer
        style={{
          padding: "22px clamp(20px, 5vw, 56px)",
          display: "flex",
          alignItems: "center",
          fontSize: 12,
          color: MUTED,
          borderTop: `1px solid ${HAIR}`,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Wordmark variant="dark" size="sm" />
          <span>sp. z o.o.</span>
        </span>
        <span style={{ marginLeft: "auto" }}>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
