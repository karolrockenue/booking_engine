"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";

interface BookingProgressProps {
  /** 1 = Select Room, 2 = Your Details, 3 = Payment, 4 = Confirmation */
  currentStep: 1 | 2 | 3 | 4;
}

const steps = [
  { label: "Select Room", number: 1 },
  { label: "Your Details", number: 2 },
  { label: "Payment", number: 3 },
  { label: "Confirmation", number: 4 },
];

export function BookingProgress({ currentStep }: BookingProgressProps) {
  const theme = useTheme();
  const primaryColor = theme.colors.primary;
  const progressPercent = Math.round((currentStep / steps.length) * 100);

  return (
    <div
      className="w-full z-40 relative"
      style={{ backgroundColor: "#fff", borderBottom: "1px solid var(--color-border)" }}
    >
      {/* Progress fill bar at very top */}
      <div
        className="absolute top-0 left-0 h-[3px] transition-all duration-500 ease-out"
        style={{
          backgroundColor: primaryColor,
          width: `${progressPercent}%`,
        }}
      />

      <div
        className="mx-auto py-5 flex items-center"
        style={{
          maxWidth: "var(--layout-max-width)",
          paddingLeft: "var(--container-padding)",
          paddingRight: "var(--container-padding)",
        }}
      >
        {steps.map((step, i) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isFuture = step.number > currentStep;

          return (
            <div key={step.number} className="contents">
              {/* Step */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    backgroundColor: isCompleted || isCurrent ? primaryColor : "transparent",
                    color: isCompleted || isCurrent ? "#fff" : "#9ca3af",
                    border: isFuture ? "2px solid #d1d5db" : "none",
                  }}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className="text-sm hidden sm:block whitespace-nowrap"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: isCurrent ? 600 : 400,
                    color: isFuture ? "#9ca3af" : "var(--color-text)",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line — equal width between all steps */}
              {i < steps.length - 1 && (
                <div className="flex-1 mx-5">
                  <div
                    className="h-px w-full"
                    style={{
                      backgroundColor: isCompleted ? primaryColor : "#d1d5db",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
