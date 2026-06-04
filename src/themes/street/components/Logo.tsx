import type { StreetTokens } from "../tokens";

// Street's logo is purely typographic — property name in Fraunces with a
// muted sans subtitle below. No image asset; works for any hotel name.

export function StreetLogo({
  t,
  name,
  subtitle,
  size = "md",
}: {
  t: StreetTokens;
  name: string;
  subtitle?: string;
  size?: "sm" | "md";
}) {
  const nameSize = size === "md" ? 20 : 16;
  const subSize = 9;
  return (
    <div
      style={{
        fontFamily: "var(--street-serif)",
        fontSize: nameSize,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        color: t.ink,
        lineHeight: 1,
      }}
    >
      {name}
      {subtitle && (
        <div
          style={{
            fontFamily: "var(--street-sans)",
            fontSize: subSize,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: t.inkMuted,
            fontWeight: 500,
            marginTop: 5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
