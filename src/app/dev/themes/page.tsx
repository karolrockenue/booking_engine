import Link from "next/link";
import { getActiveTheme } from "@/lib/active-theme";

const CARDS = [
  {
    slug: "default",
    label: "Default",
    desc: "The current live design — pre-Portico look.",
    bg: "#ffffff",
    ink: "#1a1a1a",
    accent: "#0a766c",
    border: "#e6e6e6",
  },
  {
    slug: "portico-ivory",
    label: "Portico · Direction C — Ivory",
    desc: "Warm ivory ground, deep teal accent. Gallery-white booking flow.",
    bg: "#faf8f3",
    ink: "#1f1c18",
    accent: "#0e4a4a",
    border: "rgba(31,28,24,0.13)",
  },
] as const;

export default async function DevThemesPage() {
  const active = await getActiveTheme();
  const isProd = process.env.NODE_ENV === "production";
  const envTheme = process.env.THEME ?? "(unset)";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0e1012",
        color: "#e9e6e0",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        padding: "48px 32px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#8a8a8a",
            marginBottom: 14,
          }}
        >
          Dev · Theme switcher
        </div>
        <h1
          style={{
            fontSize: 32,
            margin: "0 0 8px",
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          Pick a design.
        </h1>
        <p style={{ color: "#a8a8a8", margin: "0 0 32px", fontSize: 14, lineHeight: 1.6 }}>
          Click a theme to set a session cookie and reload the homepage in that design.
          {isProd ? (
            <>
              {" "}
              <strong style={{ color: "#ff9d6a" }}>Production:</strong> the cookie is ignored —
              this Railway service is locked to <code>THEME={envTheme}</code>.
            </>
          ) : (
            <>
              {" "}Backend, Cloudbeds, and Stripe are identical across every theme.
            </>
          )}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            marginBottom: 32,
          }}
        >
          {CARDS.map((c) => {
            const isActive = active === c.slug;
            return (
              <article
                key={c.slug}
                style={{
                  background: c.bg,
                  color: c.ink,
                  border: `1px solid ${isActive ? c.accent : c.border}`,
                  padding: "22px 22px 18px",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  minHeight: 220,
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 14,
                      fontSize: 9,
                      letterSpacing: "0.24em",
                      textTransform: "uppercase",
                      color: c.accent,
                    }}
                  >
                    · Active
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    opacity: 0.7,
                  }}
                >
                  {c.slug}
                </div>
                <div style={{ fontSize: 19, lineHeight: 1.2, fontWeight: 500 }}>{c.label}</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.85, flex: 1 }}>{c.desc}</div>
                <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
                  <Swatch color={c.bg} label="bg" border={c.border} />
                  <Swatch color={c.ink} label="ink" border={c.border} />
                  <Swatch color={c.accent} label="accent" border={c.border} />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Link
                    href={`/dev/themes/set?theme=${c.slug}&next=/`}
                    style={{
                      background: c.ink,
                      color: c.bg,
                      padding: "10px 18px",
                      fontSize: 10,
                      letterSpacing: "0.26em",
                      textTransform: "uppercase",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    Open homepage →
                  </Link>
                  <Link
                    href={`/dev/themes/set?theme=${c.slug}&next=/rooms`}
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.26em",
                      textTransform: "uppercase",
                      color: c.accent,
                      textDecoration: "none",
                      borderBottom: `1px solid ${c.accent}`,
                      paddingBottom: 1,
                    }}
                  >
                    Rooms
                  </Link>
                  <Link
                    href={`/dev/themes/set?theme=${c.slug}&next=/book`}
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.26em",
                      textTransform: "uppercase",
                      color: c.accent,
                      textDecoration: "none",
                      borderBottom: `1px solid ${c.accent}`,
                      paddingBottom: 1,
                    }}
                  >
                    Book
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div
          style={{
            border: "1px solid #2a2c30",
            padding: "16px 18px",
            fontSize: 12,
            color: "#9a9a9a",
            lineHeight: 1.6,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: "#e9e6e0" }}>Currently active:</strong>{" "}
            <code style={{ color: "#fff" }}>{active}</code>
          </div>
          <div>
            <code>process.env.THEME</code> ={" "}
            <code style={{ color: "#fff" }}>{envTheme}</code>
            {" · "}
            <code>NODE_ENV</code> ={" "}
            <code style={{ color: "#fff" }}>{process.env.NODE_ENV}</code>
            {" · "}
            <Link href="/dev/themes/clear" style={{ color: "#8ab4ff" }}>
              clear dev cookie
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Swatch({ color, label, border }: { color: string; label: string; border: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
      <div
        style={{
          width: 36,
          height: 36,
          background: color,
          border: `1px solid ${border}`,
        }}
      />
      <span style={{ fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
        {label}
      </span>
    </div>
  );
}
