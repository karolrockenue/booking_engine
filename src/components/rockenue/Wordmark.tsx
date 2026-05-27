// Rockenue Tech wordmark. Matches rockenue.com styling — teal `(`, ivory/dark
// wordmark, gold `)`. Use variant="dark" on the platform landing (dark bg),
// variant="light" on the admin chrome (white bg).

const TEAL = "#38C6BA";
const GOLD = "#C8A66E";
const INK_DARK = "#F4F2EC"; // wordmark on dark bg
const INK_LIGHT = "#14181D"; // wordmark on light bg

interface WordmarkProps {
  variant?: "dark" | "light";
  size?: "sm" | "md";
}

export function Wordmark({ variant = "dark", size = "md" }: WordmarkProps) {
  const wordmarkColor = variant === "dark" ? INK_DARK : INK_LIGHT;
  const wordSize = size === "md" ? 14 : 12;
  const parenSize = size === "md" ? 26 : 22;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        lineHeight: 1,
      }}
    >
      <span style={{ color: TEAL, fontSize: parenSize, fontWeight: 300, lineHeight: 1 }}>(</span>
      <span
        style={{
          color: wordmarkColor,
          fontSize: wordSize,
          fontWeight: 700,
          letterSpacing: 1.4,
        }}
      >
        ROCKENUE TECH
      </span>
      <span style={{ color: GOLD, fontSize: parenSize, fontWeight: 300, lineHeight: 1 }}>)</span>
    </span>
  );
}
