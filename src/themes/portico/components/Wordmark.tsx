// Stylised portico (pediment, two fluted columns, plinth) + serif wordmark.
// Placeholder mark per the design handoff; replace with real brand mark before launch.

interface Props {
  size?: number;
  color?: string;
  stacked?: boolean;
  withByline?: boolean;
}

export function PorticoMark({ size = 24, color = "currentColor", stacked = false, withByline = false }: Props) {
  const h = size;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: stacked ? 0 : 12,
        flexDirection: stacked ? "column" : "row",
        color,
      }}
    >
      <svg
        width={h * 0.85}
        height={h * 1.1}
        viewBox="0 0 34 44"
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        aria-hidden
      >
        <path d="M2 14 L17 4 L32 14" />
        <line x1="3" y1="14" x2="31" y2="14" />
        <line x1="3" y1="17" x2="31" y2="17" />
        <line x1="9" y1="17" x2="9" y2="38" />
        <line x1="11.5" y1="17" x2="11.5" y2="38" />
        <line x1="22.5" y1="17" x2="22.5" y2="38" />
        <line x1="25" y1="17" x2="25" y2="38" />
        <line x1="3" y1="38" x2="31" y2="38" />
        <line x1="2" y1="41" x2="32" y2="41" />
      </svg>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: stacked ? "center" : "flex-start",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: "var(--portico-serif)",
            fontSize: h * 0.95,
            lineHeight: 1,
            letterSpacing: "0.01em",
            fontWeight: 400,
          }}
        >
          The Portico
        </div>
        {withByline && (
          <div
            style={{
              fontFamily: "var(--portico-sans)",
              fontSize: 9,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              opacity: 0.7,
              marginTop: 4,
            }}
          >
            Hotel · London
          </div>
        )}
      </div>
    </div>
  );
}
