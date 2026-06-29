"use client";

import { useRef, useState } from "react";
import RyftPaymentSection, {
  type RyftPaymentSectionHandle,
} from "@/components/checkout/RyftPaymentSection";

interface Props {
  token: string;
  clientSecret: string;
  // The fresh card-save (verifyAccount) session minted for this update. We send
  // it to the server so it can verify the new card was saved against it and
  // adopt it as the booking's COF mandate.
  verifySessionId: string;
  accountId: string | null;
  publicKey: string;
  customerEmail?: string;
}

// Ryft analog of PaymentUpdateClient. The guest re-enters a card into Ryft's
// CardForm (saveCard → the SDK runs the zero-value Unscheduled mandate), then we
// hand the verify session back to the server to swap the saved card onto the
// booking and re-arm the auto-charge cron.
export function RyftPaymentUpdateClient({
  token,
  clientSecret,
  verifySessionId,
  accountId,
  publicKey,
  customerEmail,
}: Props) {
  const ryftRef = useRef<RyftPaymentSectionHandle>(null);
  const [status, setStatus] = useState<
    "idle" | "saving" | "succeeded" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!ryftRef.current) return;
    setStatus("saving");
    setError(null);
    try {
      const result = await ryftRef.current.confirm();
      const confirmedSessionId = result.paymentSessionId ?? verifySessionId;
      const res = await fetch("/api/bookings/payment-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ryftVerifySessionId: confirmedSessionId,
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
      <RyftPaymentSection
        ref={ryftRef}
        clientSecret={clientSecret}
        publicKey={publicKey}
        accountId={accountId}
        customerEmail={customerEmail}
        saveCard
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
