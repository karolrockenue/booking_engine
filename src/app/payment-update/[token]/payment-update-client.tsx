"use client";

import { useRef, useState } from "react";
import StripePaymentSection, {
  type StripePaymentSectionHandle,
} from "@/components/checkout/StripePaymentSection";

interface Props {
  token: string;
  clientSecret: string;
  setupIntentId: string;
}

export function PaymentUpdateClient({
  token,
  clientSecret,
  setupIntentId,
}: Props) {
  const stripeRef = useRef<StripePaymentSectionHandle>(null);
  const [status, setStatus] = useState<
    "idle" | "saving" | "succeeded" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!stripeRef.current) return;
    setStatus("saving");
    setError(null);
    try {
      const result = await stripeRef.current.confirm();
      const confirmedSetupIntentId = result.setupIntentId ?? setupIntentId;
      const res = await fetch("/api/bookings/payment-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          setupIntentId: confirmedSetupIntentId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Server returned ${res.status}`);
      }
      setStatus("succeeded");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Card update failed");
    }
  }

  if (status === "succeeded") {
    return (
      <div
        style={{
          padding: "16px 18px",
          background: "#dcfce7",
          border: "1px solid #86efac",
          borderRadius: 6,
          marginTop: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "#14532d",
          }}
        >
          Card saved
        </div>
        <p
          style={{ margin: "6px 0 0", fontSize: 14, color: "#1f2937", lineHeight: 1.5 }}
        >
          Thanks. We&rsquo;ll retry the charge automatically within a few
          minutes and email you a confirmation when it&rsquo;s done.
        </p>
      </div>
    );
  }

  return (
    <div>
      <StripePaymentSection
        ref={stripeRef}
        kind="setup"
        clientSecret={clientSecret}
      />
      {error && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            fontSize: 13,
            color: "#7f1d1d",
          }}
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving"}
        style={{
          marginTop: 16,
          width: "100%",
          background: status === "saving" ? "#6b7280" : "#15252a",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "12px 20px",
          fontSize: 15,
          fontWeight: 600,
          cursor: status === "saving" ? "wait" : "pointer",
        }}
      >
        {status === "saving" ? "Saving…" : "Save card"}
      </button>
    </div>
  );
}
