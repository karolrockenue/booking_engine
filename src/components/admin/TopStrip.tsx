import type { ReactNode } from "react";

interface TopStripProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: { text: string; tone?: "green" | "amber" | "red" | "blue" };
  actions?: ReactNode;
}

const BADGE_TONES = {
  green: { color: "var(--a-green)", bg: "var(--a-green-soft)", border: "rgba(0,135,90,0.18)" },
  amber: { color: "var(--a-amber)", bg: "var(--a-amber-soft)", border: "rgba(180,83,9,0.18)" },
  red:   { color: "var(--a-red)",   bg: "var(--a-red-soft)",   border: "rgba(198,40,40,0.18)" },
  blue:  { color: "var(--a-blue)",  bg: "var(--a-blue-soft)",  border: "rgba(29,78,216,0.18)" },
};

export function TopStrip({ title, subtitle, badge, actions }: TopStripProps) {
  return (
    <div className="flex items-start gap-4 pb-4 mb-6 border-b" style={{ borderColor: "var(--a-border)" }}>
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2">
          <span>{title}</span>
          {badge && <Badge {...badge} />}
        </h1>
        {subtitle && (
          <div className="font-jbm text-[12px] mt-1" style={{ color: "var(--a-muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

function Badge({ text, tone = "green" }: { text: string; tone?: "green" | "amber" | "red" | "blue" }) {
  const t = BADGE_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border align-middle"
      style={{ color: t.color, background: t.bg, borderColor: t.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
      {text}
    </span>
  );
}

export function Btn({
  children,
  variant = "secondary",
  onClick,
  href,
  newTab,
  className = "",
  size = "md",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  onClick?: () => void;
  href?: string;
  newTab?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]";
  const styleByVariant = {
    primary: { background: "var(--a-ink)", color: "#fff", border: "1px solid var(--a-ink)" },
    secondary: { background: "var(--a-surface)", color: "var(--a-ink)", border: "1px solid var(--a-border)" },
    danger: { background: "var(--a-surface)", color: "var(--a-red)", border: "1px solid rgba(198,40,40,0.25)" },
    ghost: { background: "transparent", color: "var(--a-ink-2)", border: "1px solid transparent" },
  };
  const cls = `inline-flex items-center gap-1.5 rounded font-medium hover:opacity-90 ${padding} ${className}`;
  const style = styleByVariant[variant];
  if (href) {
    const externalProps = newTab
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};
    return (
      <a href={href} className={cls} style={style} {...externalProps}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}
