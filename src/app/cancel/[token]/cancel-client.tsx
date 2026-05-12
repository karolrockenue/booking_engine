"use client";

import { useState } from "react";

export function CancelClient({
  token,
  willRefund,
  refundAmount,
  currencySymbol,
  policyNote,
}: {
  token: string;
  willRefund: boolean;
  refundAmount: number;
  currencySymbol: string;
  policyNote?: string;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "done"; refunded: boolean; refundAmount?: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function confirmCancel() {
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await res.json()) as
        | { outcome: "cancelled"; refunded: boolean; refundAmount?: number }
        | { outcome: "already_cancelled" }
        | { outcome: "ineligible"; reason: string }
        | { error: string };

      if (!res.ok && !("outcome" in body)) {
        setState({ kind: "error", message: body.error ?? "Cancellation failed" });
        return;
      }
      if ("outcome" in body && body.outcome === "ineligible") {
        setState({ kind: "error", message: "This booking is no longer eligible for self-cancellation. Please contact the hotel." });
        return;
      }
      if ("outcome" in body) {
        setState({
          kind: "done",
          refunded: body.outcome === "cancelled" ? body.refunded : false,
          refundAmount: body.outcome === "cancelled" ? body.refundAmount : undefined,
        });
        return;
      }
      setState({ kind: "error", message: "Unexpected response" });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div>
        <div style={{ padding: "14px 16px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 6, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#065f46" }}>Booking cancelled</div>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#444", lineHeight: 1.5 }}>
            {state.refunded
              ? `Your refund of ${currencySymbol}${(state.refundAmount ?? 0).toFixed(2)} has been issued. It typically appears on your statement within 5–10 business days.`
              : "No charge was taken, so there's nothing to refund. The room is released and the saved card has been removed."}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "#666", lineHeight: 1.5 }}>
          A confirmation email is on its way. You can close this window.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "14px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#374151" }}>
          {willRefund ? "Refund will be issued" : "Free cancellation"}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#444", lineHeight: 1.5 }}>
          {willRefund
            ? `If you cancel now, ${currencySymbol}${refundAmount.toFixed(2)} will be refunded to the original payment method.`
            : "No charge has been taken. Cancelling will release the room and remove the saved card from our records."}
          {policyNote ? ` ${policyNote}` : ""}
        </p>
      </div>

      {state.kind === "error" && (
        <div style={{ padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, marginBottom: 16, fontSize: 13, color: "#991b1b" }}>
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={confirmCancel}
          disabled={state.kind === "submitting"}
          style={{
            padding: "12px 20px",
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor: state.kind === "submitting" ? "wait" : "pointer",
            opacity: state.kind === "submitting" ? 0.6 : 1,
            letterSpacing: 0.3,
          }}
        >
          {state.kind === "submitting" ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button
          onClick={() => window.close()}
          disabled={state.kind === "submitting"}
          style={{
            padding: "12px 16px",
            background: "transparent",
            color: "#666",
            border: "none",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Keep booking
        </button>
      </div>
    </div>
  );
}
