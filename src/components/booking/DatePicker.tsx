"use client";

interface DatePickerProps {
  checkIn: string;
  checkOut: string;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
}

export function DatePicker({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
}: DatePickerProps) {
  const today = new Date().toISOString().split("T")[0];

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
          Check-in
        </label>
        <input
          type="date"
          value={checkIn}
          min={today}
          onChange={(e) => onCheckInChange(e.target.value)}
          className="w-full px-4 py-3 text-sm"
          style={{
            fontFamily: "var(--font-body)",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text)",
          }}
        />
      </div>
      <div>
        <label
          className="block text-xs uppercase tracking-wider mb-2 font-medium"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-muted)",
          }}
        >
          Check-out
        </label>
        <input
          type="date"
          value={checkOut}
          min={checkIn || today}
          onChange={(e) => onCheckOutChange(e.target.value)}
          className="w-full px-4 py-3 text-sm"
          style={{
            fontFamily: "var(--font-body)",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            color: "var(--color-text)",
          }}
        />
      </div>
    </div>
  );
}
