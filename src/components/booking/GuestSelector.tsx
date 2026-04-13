"use client";

interface GuestSelectorProps {
  adults: number;
  children: number;
  onAdultsChange: (n: number) => void;
  onChildrenChange: (n: number) => void;
}

export function GuestSelector({
  adults,
  children,
  onAdultsChange,
  onChildrenChange,
}: GuestSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-muted)",
          }}
        >
          Adults
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onAdultsChange(Math.max(1, adults - 1))}
            className="w-10 h-10 flex items-center justify-center text-lg"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            &minus;
          </button>
          <span
            className="text-base font-medium w-6 text-center"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-text)" }}
          >
            {adults}
          </span>
          <button
            type="button"
            onClick={() => onAdultsChange(Math.min(10, adults + 1))}
            className="w-10 h-10 flex items-center justify-center text-lg"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      </div>
      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-muted)",
          }}
        >
          Children
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChildrenChange(Math.max(0, children - 1))}
            className="w-10 h-10 flex items-center justify-center text-lg"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            &minus;
          </button>
          <span
            className="text-base font-medium w-6 text-center"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-text)" }}
          >
            {children}
          </span>
          <button
            type="button"
            onClick={() => onChildrenChange(Math.min(6, children + 1))}
            className="w-10 h-10 flex items-center justify-center text-lg"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius)",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
