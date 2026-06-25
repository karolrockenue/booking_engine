"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

// Ryft onboarding + status for a hotel. Ryft is the marketplace rail replacing
// Stripe Connect: the hotel is a Ryft "sub-account", money settles to them, we
// take our platform fee, and Ryft's card fee is booked to the hotel.

interface PropertyData {
  ryftAccountId: string | null;
  ryftAccountStatus: string | null;
  ryftAccountCurrency: string | null;
  platformFeePercent: string | null;
  currency: string | null;
}

export default function RyftPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();
  const [data, setData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/properties/${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message ?? "failed to load"))
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnect() {
    if (!token || !propertyId) return;
    setConnecting(true);
    try {
      const r = await fetch("/api/ryft/connect/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        onboardingUrl?: string;
        error?: string;
      };
      if (!r.ok || !body.onboardingUrl) {
        alert(body.error ?? `Failed to start onboarding (HTTP ${r.status})`);
        return;
      }
      window.location.href = body.onboardingUrl;
    } finally {
      setConnecting(false);
    }
  }

  if (loading && !data) {
    return <TopStrip title="Ryft & payments" subtitle="Loading…" />;
  }
  if (error || !data) {
    return (
      <>
        <TopStrip title="Ryft & payments" subtitle="Failed to load" />
        <div className="text-[13px]" style={{ color: "var(--a-red)" }}>
          {error}
        </div>
      </>
    );
  }

  const status = data.ryftAccountStatus;
  const connected = !!data.ryftAccountId;
  const badge =
    status === "active"
      ? ({ text: "active", tone: "green" } as const)
      : status === "restricted"
        ? ({ text: "restricted", tone: "red" } as const)
        : connected
          ? ({ text: status ?? "pending", tone: "amber" } as const)
          : ({ text: "not connected", tone: "red" } as const);

  return (
    <>
      <TopStrip
        title="Ryft & payments"
        badge={badge}
        subtitle={
          connected
            ? `${data.ryftAccountId} · ${(data.ryftAccountCurrency ?? data.currency ?? "").toUpperCase()}`
            : "No Ryft sub-account yet — guest payments and platform fees are disabled until onboarding completes."
        }
        actions={
          <div className="flex gap-1.5">
            <Btn variant="primary" onClick={handleConnect}>
              {connecting
                ? "Redirecting…"
                : status === "active"
                  ? "Manage onboarding"
                  : connected
                    ? "Resume onboarding"
                    : "Connect to Ryft"}
            </Btn>
            {connected && (
              <Btn onClick={load}>Refresh status</Btn>
            )}
          </div>
        }
      />

      {!connected ? (
        <div
          className="border rounded-md p-12 text-center text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
        >
          Click{" "}
          <strong style={{ color: "var(--a-ink)" }}>Connect to Ryft</strong> to
          create this hotel&apos;s Ryft sub-account and start hosted onboarding.
        </div>
      ) : (
        <div
          className="border rounded-md overflow-hidden"
          style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
        >
          <Kv k="Sub-account ID">
            <span className="font-jbm">{data.ryftAccountId}</span>
          </Kv>
          <Kv k="Status">{status ?? "pending"}</Kv>
          <Kv k="Account currency">
            {(data.ryftAccountCurrency ?? data.currency ?? "—").toUpperCase()}
          </Kv>
          <Kv k="Your platform fee">{data.platformFeePercent ?? "—"}%</Kv>
          <Kv k="Card processing fee">
            booked to the hotel (deducted from their settlement)
          </Kv>
          <div
            className="px-4 py-3 text-[11.5px]"
            style={{ color: "var(--a-muted)" }}
          >
            On a £100 booking at {data.platformFeePercent ?? "—"}%: the guest
            pays £100, you keep your fee, Ryft&apos;s card fee comes off the
            hotel, and the hotel nets the remainder. &quot;active&quot; means
            card payments are enabled and this hotel can take bookings on Ryft.
          </div>
        </div>
      )}
    </>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 px-4 py-2 text-[12.5px] border-b last:border-b-0"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      <div className="w-[160px] flex-shrink-0" style={{ color: "var(--a-muted)" }}>
        {k}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
