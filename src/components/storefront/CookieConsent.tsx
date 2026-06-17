"use client";

import { useEffect, useState } from "react";

// Discreet, flat bottom-bar cookie consent. Mounted by the storefront layout
// only when the hotel has analytics configured (otherwise there are no
// non-essential cookies and no banner is needed).
//
// Consent Mode v2: the layout sets analytics_storage to "denied" by default
// before GA loads. This component flips it to "granted" once (and only if) the
// guest accepts, and persists the choice in a first-party cookie so returning
// guests aren't re-prompted.

const COOKIE = "cookie_consent"; // "granted" | "denied"
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days

function readChoice(): "granted" | "denied" | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)cookie_consent=(granted|denied)/);
  return m ? (m[1] as "granted" | "denied") : null;
}

function writeChoice(v: "granted" | "denied") {
  document.cookie = `${COOKIE}=${v}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

function applyConsent(v: "granted" | "denied") {
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  w.gtag?.("consent", "update", { analytics_storage: v });
}

export function CookieConsent({ cookiePolicyHref }: { cookiePolicyHref: string }) {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);

  useEffect(() => {
    const choice = readChoice();
    // Re-apply the stored choice each load (Consent Mode default is "denied").
    if (choice) applyConsent(choice);
    // Reveal after mount, not during render — server renders nothing, so the
    // banner can't cause a hydration mismatch. setState-in-effect is the
    // intended SSR-safe pattern here (we're syncing from a first-party cookie).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnalyticsOn(choice === "granted");
    setVisible(choice === null);

    // Allow a footer "Cookie settings" link to reopen the banner.
    const open = () => {
      setAnalyticsOn(readChoice() === "granted");
      setShowPrefs(true);
      setVisible(true);
    };
    (window as unknown as { openCookieSettings?: () => void }).openCookieSettings = open;
    window.addEventListener("cookie-settings:open", open);
    return () => window.removeEventListener("cookie-settings:open", open);
  }, []);

  function decide(v: "granted" | "denied") {
    writeChoice(v);
    applyConsent(v);
    setVisible(false);
    setShowPrefs(false);
  }

  if (!visible) return null;

  return (
    <div role="dialog" aria-label="Cookie consent" style={S.bar}>
      <div style={S.inner}>
        <p style={S.text}>
          We use essential cookies to make booking work, and — with your consent —
          Google Analytics to improve the site.{" "}
          <a href={cookiePolicyHref} style={S.link}>
            Cookie Policy
          </a>
        </p>

        {showPrefs && (
          <div style={S.prefs}>
            <span style={S.prefItem}>
              <span style={S.dotLocked} /> Strictly necessary · always on
            </span>
            <button
              type="button"
              onClick={() => setAnalyticsOn((v) => !v)}
              aria-pressed={analyticsOn}
              style={S.prefToggle}
            >
              <span style={{ ...S.tog, ...(analyticsOn ? S.togOn : null) }}>
                <span style={{ ...S.knob, ...(analyticsOn ? S.knobOn : null) }} />
              </span>
              Analytics
            </button>
          </div>
        )}

        <div style={S.actions}>
          {showPrefs ? (
            <>
              <button type="button" style={S.btnText} onClick={() => decide("denied")}>
                Reject
              </button>
              <button
                type="button"
                style={S.btnSolid}
                onClick={() => decide(analyticsOn ? "granted" : "denied")}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button type="button" style={S.btnText} onClick={() => setShowPrefs(true)}>
                Manage
              </button>
              <button type="button" style={S.btnOutline} onClick={() => decide("denied")}>
                Reject
              </button>
              <button type="button" style={S.btnSolid} onClick={() => decide("granted")}>
                Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "saturate(180%) blur(8px)",
    borderTop: "1px solid rgba(0,0,0,0.08)",
    fontFamily:
      "var(--portico-sans, 'Inter', system-ui, sans-serif)",
  },
  inner: {
    maxWidth: 1280,
    margin: "0 auto",
    padding: "12px 24px",
    display: "flex",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  },
  text: { flex: 1, minWidth: 240, fontSize: 12.5, lineHeight: 1.5, color: "#3a3632", margin: 0 },
  link: { color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 },
  prefs: { display: "flex", alignItems: "center", gap: 18 },
  prefItem: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "#6b6258" },
  dotLocked: { width: 7, height: 7, borderRadius: "50%", background: "#9aa5a0", display: "inline-block" },
  prefToggle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12.5,
    color: "#1f1c18",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  tog: {
    width: 34,
    height: 19,
    borderRadius: 99,
    background: "#d8d1c4",
    position: "relative",
    transition: "background .15s",
    display: "inline-block",
  },
  togOn: { background: "#0e4a4a" },
  knob: {
    position: "absolute",
    width: 15,
    height: 15,
    borderRadius: "50%",
    background: "#fff",
    top: 2,
    left: 2,
    transition: "left .15s",
    boxShadow: "0 1px 2px rgba(0,0,0,.25)",
  },
  knobOn: { left: 17 },
  actions: { display: "flex", alignItems: "center", gap: 8, flex: "none" },
  btnText: {
    font: "inherit",
    fontSize: 12.5,
    color: "#6b6258",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px 10px",
  },
  btnOutline: {
    font: "inherit",
    fontSize: 12.5,
    fontWeight: 500,
    color: "#1f1c18",
    background: "transparent",
    border: "1px solid rgba(0,0,0,0.2)",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 16px",
  },
  btnSolid: {
    font: "inherit",
    fontSize: 12.5,
    fontWeight: 500,
    color: "#faf8f3",
    background: "#1f1c18",
    border: "1px solid #1f1c18",
    borderRadius: 8,
    cursor: "pointer",
    padding: "8px 16px",
  },
};
