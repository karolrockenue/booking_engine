"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface StripeData {
  connected: boolean;
  account: {
    id: string;
    country: string | null;
    defaultCurrency: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    businessType: string | null;
    email: string | null;
    requirements: {
      currentlyDue: string[];
      pastDue: string[];
      disabledReason: string | null;
    } | null;
    capabilities: Record<string, string>;
    payouts: { schedule: { interval?: string; weekly_anchor?: string } | null };
  } | null;
  platform: {
    feesByCurrency: Array<{
      currency: string;
      totalMinorUnits: number;
      count: number;
    }>;
    platformFeePercent: string | null;
  } | null;
  hotel: {
    balance: {
      available: Array<{ amountMinorUnits: number; currency: string }>;
      pending: Array<{ amountMinorUnits: number; currency: string }>;
    } | null;
    payouts: Array<{
      id: string;
      amountMinorUnits: number;
      currency: string;
      arrivalDate: string;
      status: string;
      method: string | null;
    }>;
    refunds: Array<{
      id: string;
      amountMinorUnits: number;
      currency: string;
      status: string | null;
      reason: string | null;
      created: string;
      paymentIntentId: string | null;
    }>;
  } | null;
  fromDb: {
    platformFeePercent: string | null;
    payoutSchedule: string | null;
    stripeAccountStatus: string | null;
    stripeAccountCurrency: string | null;
  };
  errors?: string[];
}

export default function StripePage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();
  const [data, setData] = useState<StripeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/properties/${propertyId}/stripe`, {
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

  async function handleStartConnect() {
    if (!token || !propertyId) return;
    setConnecting(true);
    try {
      const r = await fetch("/api/stripe/connect/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        alert(body.error ?? `Failed to start onboarding (HTTP ${r.status})`);
        return;
      }
      const body = (await r.json()) as { url?: string };
      if (body.url) window.location.href = body.url;
    } finally {
      setConnecting(false);
    }
  }

  if (loading && !data) {
    return (
      <>
        <TopStrip title="Stripe & payouts" subtitle="Loading…" />
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <TopStrip title="Stripe & payouts" subtitle="Failed to load" />
        <div className="text-[13px]" style={{ color: "var(--a-red)" }}>
          {error}
        </div>
      </>
    );
  }

  if (!data.connected) {
    return (
      <>
        <TopStrip
          title="Stripe & payouts"
          badge={{ text: "not connected", tone: "red" }}
          subtitle="No connected account yet — guest payments and platform fees are disabled until onboarding completes."
          actions={
            <Btn variant="primary" onClick={handleStartConnect}>
              {connecting ? "Redirecting…" : "Start onboarding"}
            </Btn>
          }
        />
        <div
          className="border rounded-md p-12 text-center text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
        >
          Click <strong style={{ color: "var(--a-ink)" }}>Start onboarding</strong> to begin Stripe Connect for this hotel.
        </div>
      </>
    );
  }

  const acct = data.account;
  const status = data.fromDb.stripeAccountStatus;
  const stripeUrl = acct
    ? `https://dashboard.stripe.com/connect/accounts/${acct.id}`
    : undefined;
  const totalFees = data.platform?.feesByCurrency ?? [];
  const recent = data.hotel?.payouts ?? [];
  const refunds = data.hotel?.refunds ?? [];
  const pending = data.hotel?.balance?.pending ?? [];
  const available = data.hotel?.balance?.available ?? [];

  return (
    <>
      <TopStrip
        title="Stripe & payouts"
        badge={
          status === "active"
            ? { text: "active", tone: "green" }
            : status === "restricted"
              ? { text: "restricted", tone: "red" }
              : { text: status ?? "pending", tone: "amber" }
        }
        subtitle={
          acct
            ? `${acct.id} · Standard · ${(acct.defaultCurrency ?? data.fromDb.stripeAccountCurrency ?? "").toUpperCase()} · ${acct.country ?? ""}`
            : `${data.fromDb.stripeAccountStatus ?? "pending"} · ${data.fromDb.stripeAccountCurrency ?? ""}`
        }
        actions={
          stripeUrl ? (
            <Btn href={stripeUrl} newTab>
              Open in Stripe ↗
            </Btn>
          ) : null
        }
      />

      {acct?.requirements?.disabledReason && (
        <div
          className="border-l-4 px-4 py-3 mb-4 text-[12.5px]"
          style={{
            borderColor: "var(--a-red)",
            background: "var(--a-red-soft)",
            color: "var(--a-red)",
          }}
        >
          <strong>Account restricted.</strong> Stripe says:{" "}
          <span className="font-jbm">{acct.requirements.disabledReason}</span>.
          Open in Stripe to resolve.
        </div>
      )}

      {data.errors && data.errors.length > 0 && (
        <div
          className="border rounded-md px-3 py-2 mb-4 text-[11.5px]"
          style={{
            borderColor: "rgba(180,83,9,0.25)",
            background: "var(--a-amber-soft)",
            color: "var(--a-amber)",
          }}
        >
          Some Stripe data couldn&apos;t load: {data.errors.join(" · ")}
        </div>
      )}

      {/* YOUR PLATFORM SIDE */}
      <SectionLabel>Your platform</SectionLabel>
      <div
        className="grid grid-cols-2 lg:grid-cols-4 border rounded-md overflow-hidden mb-5"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
      >
        <Stat
          label="Fees · 30d"
          value={
            totalFees.length
              ? formatTotalFees(totalFees)
              : "—"
          }
          delta={
            totalFees.length
              ? `${totalFees.reduce((s, f) => s + f.count, 0)} bookings · ${data.platform?.platformFeePercent ?? "—"}% rate`
              : "no fees collected"
          }
        />
        <Stat
          label="Bookings (this hotel · 30d)"
          value={
            totalFees.length
              ? totalFees.reduce((s, f) => s + f.count, 0).toString()
              : "0"
          }
          delta="application_fee count"
        />
        <Stat
          label="Platform fee %"
          value={`${data.platform?.platformFeePercent ?? data.fromDb.platformFeePercent ?? "—"}%`}
          delta="taken from each booking"
        />
        <Stat
          label="Account status"
          value={status ?? "pending"}
          delta={
            acct?.chargesEnabled
              ? "charges enabled"
              : "charges disabled"
          }
          tone={status === "active" ? "default" : "amber"}
        />
      </div>

      {/* HOTEL SIDE */}
      <SectionLabel>Hotel side · read-only</SectionLabel>
      <p
        className="text-[11.5px] mb-3"
        style={{ color: "var(--a-muted)" }}
      >
        The hotel owns this account. Money settles to their bank, not yours. You see this via the connected-account API.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          {/* Recent payouts */}
          <Card>
            <CardHead>
              <h2 className="text-[12.5px] font-semibold">Their recent payouts</h2>
              <span
                className="ml-auto font-jbm text-[11px]"
                style={{ color: "var(--a-muted)" }}
              >
                last {recent.length}
              </span>
            </CardHead>
            {recent.length === 0 ? (
              <Empty>No payouts yet.</Empty>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr>
                    <Th>Arrival</Th>
                    <Th align="right">Amount</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.id}>
                      <Td mono>
                        {new Date(p.arrivalDate).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                      <Td align="right" mono>
                        {formatMinor(p.amountMinorUnits, p.currency)}
                      </Td>
                      <Td muted mono>
                        {p.method ?? "—"}
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            p.status === "paid"
                              ? "green"
                              : p.status === "in_transit" || p.status === "pending"
                                ? "blue"
                                : p.status === "failed" || p.status === "canceled"
                                  ? "red"
                                  : "gray"
                          }
                        >
                          {p.status}
                        </Pill>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Failed Flex auto-charges (placeholder) */}
          <Card>
            <CardHead>
              <h2 className="text-[12.5px] font-semibold">Failed Flex auto-charges</h2>
              <span
                className="ml-auto font-jbm text-[11px]"
                style={{ color: "var(--a-muted)" }}
              >
                Phase 5 · not started
              </span>
            </CardHead>
            <Empty>
              No failures. When the auto-charge cron can&apos;t take a card on cutoff, it&apos;ll land here with a &quot;send re-auth link&quot; action and 24h grace timer.
            </Empty>
          </Card>

          {/* Refunds */}
          <Card>
            <CardHead>
              <h2 className="text-[12.5px] font-semibold">Refunds issued</h2>
              <span
                className="ml-auto font-jbm text-[11px]"
                style={{ color: "var(--a-muted)" }}
              >
                last {refunds.length}
              </span>
            </CardHead>
            {refunds.length === 0 ? (
              <Empty>No refunds issued.</Empty>
            ) : (
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th align="right">Amount</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <Td mono>
                        {new Date(r.created).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </Td>
                      <Td align="right" mono>
                        {formatMinor(r.amountMinorUnits, r.currency)}
                      </Td>
                      <Td muted>{r.reason ?? "—"}</Td>
                      <Td>
                        <Pill
                          tone={
                            r.status === "succeeded"
                              ? "green"
                              : r.status === "failed"
                                ? "red"
                                : "amber"
                          }
                        >
                          {r.status ?? "—"}
                        </Pill>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/* Account meta */}
          <Card>
            <CardHead>
              <h2 className="text-[12.5px] font-semibold">Account</h2>
            </CardHead>
            {acct && (
              <>
                <Kv k="Account ID">
                  <span className="font-jbm">{acct.id}</span>
                </Kv>
                <Kv k="Type">Standard</Kv>
                <Kv k="Country">{acct.country?.toUpperCase() ?? "—"}</Kv>
                <Kv k="Default currency">
                  {acct.defaultCurrency?.toUpperCase() ?? "—"}
                </Kv>
                <Kv k="Charges enabled">
                  {acct.chargesEnabled ? (
                    <Pill tone="green">yes</Pill>
                  ) : (
                    <Pill tone="red">no</Pill>
                  )}
                </Kv>
                <Kv k="Payouts enabled">
                  {acct.payoutsEnabled ? (
                    <Pill tone="green">yes</Pill>
                  ) : (
                    <Pill tone="red">no</Pill>
                  )}
                </Kv>
                <Kv k="Details submitted">
                  {acct.detailsSubmitted ? (
                    <Pill tone="green">yes</Pill>
                  ) : (
                    <Pill tone="amber">no</Pill>
                  )}
                </Kv>
                <Kv k="Payout schedule">
                  {acct.payouts.schedule?.interval ?? "—"}
                  {acct.payouts.schedule?.weekly_anchor &&
                    ` · ${acct.payouts.schedule.weekly_anchor}`}
                </Kv>
                <Kv k="Platform fee">
                  {data.fromDb.platformFeePercent ?? "—"}%
                </Kv>
              </>
            )}
            <div
              className="px-4 py-3 border-t flex gap-1.5"
              style={{ borderColor: "var(--a-border-soft)" }}
            >
              {stripeUrl && (
                <Btn size="sm" href={stripeUrl} newTab>
                  Open in Stripe ↗
                </Btn>
              )}
            </div>
          </Card>

          {/* Their pending balance */}
          <Card>
            <CardHead>
              <h2 className="text-[12.5px] font-semibold">Their balance</h2>
            </CardHead>
            <Kv k="Pending">
              {pending.length === 0 ? (
                <span style={{ color: "var(--a-muted)" }}>—</span>
              ) : (
                pending.map((b, i) => (
                  <span
                    key={`${b.currency}-${i}`}
                    className="font-jbm tabular-nums"
                  >
                    {formatMinor(b.amountMinorUnits, b.currency)}
                    {i < pending.length - 1 ? " · " : ""}
                  </span>
                ))
              )}
            </Kv>
            <Kv k="Available">
              {available.length === 0 ? (
                <span style={{ color: "var(--a-muted)" }}>—</span>
              ) : (
                available.map((b, i) => (
                  <span
                    key={`${b.currency}-${i}`}
                    className="font-jbm tabular-nums"
                  >
                    {formatMinor(b.amountMinorUnits, b.currency)}
                    {i < available.length - 1 ? " · " : ""}
                  </span>
                ))
              )}
            </Kv>
            <div
              className="px-4 py-3 text-[11px]"
              style={{ color: "var(--a-muted)" }}
            >
              Pending = funds in transit to the hotel&apos;s bank. Available = ready
              to pay out.
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── primitives ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[11px] font-medium uppercase tracking-wider mb-2"
      style={{ color: "var(--a-muted)" }}
    >
      {children}
    </h3>
  );
}

function Stat({
  label,
  value,
  delta,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className="px-[18px] py-4 border-r last:border-r-0"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      <div
        className="text-[11.5px] flex items-center gap-1.5"
        style={{ color: "var(--a-muted)" }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: tone === "amber" ? "var(--a-amber)" : "var(--a-accent)",
          }}
        />
        {label}
      </div>
      <div className="text-[20px] font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </div>
      <div
        className="text-[11.5px] mt-0.5 font-jbm"
        style={{ color: "var(--a-muted)" }}
      >
        {delta}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border rounded-md overflow-hidden"
      style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
    >
      {children}
    </div>
  );
}

function CardHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-4 py-3 flex items-center gap-2.5 border-b"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-4 py-8 text-center text-[12.5px]"
      style={{ color: "var(--a-muted)" }}
    >
      {children}
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 px-4 py-2 text-[12.5px] border-b last:border-b-0"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      <div
        className="w-[160px] flex-shrink-0"
        style={{ color: "var(--a-muted)" }}
      >
        {k}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-4 py-2 text-[10.5px] uppercase tracking-wider font-medium border-b ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: "var(--a-muted)", borderColor: "var(--a-border-soft)" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
  muted,
}: {
  children: React.ReactNode;
  align?: "right";
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`px-4 py-2 border-b last:border-b-0 ${align === "right" ? "text-right" : ""} ${mono ? "font-jbm text-[11.5px]" : ""}`}
      style={{
        borderColor: "var(--a-border-soft)",
        color: muted ? "var(--a-muted)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "blue" | "amber" | "red" | "gray";
}) {
  const tones = {
    green: { color: "var(--a-green)", bg: "var(--a-green-soft)", border: "rgba(0,135,90,0.25)" },
    blue: { color: "var(--a-accent)", bg: "var(--a-accent-soft)", border: "rgba(91,91,214,0.25)" },
    amber: { color: "var(--a-amber)", bg: "var(--a-amber-soft)", border: "rgba(180,83,9,0.25)" },
    red: { color: "var(--a-red)", bg: "var(--a-red-soft)", border: "rgba(198,40,40,0.25)" },
    gray: { color: "var(--a-muted)", bg: "#f5f5f5", border: "var(--a-border)" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10.5px] font-medium border"
      style={{ color: t.color, background: t.bg, borderColor: t.border }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: "currentColor" }} />
      {children}
    </span>
  );
}

// Stripe returns minor units (pence/cents). Currency-aware divisor for zero-decimal currencies.
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw",
  "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

function minorToMajor(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase()) ? amount : amount / 100;
}

const SYMBOL: Record<string, string> = {
  gbp: "£",
  eur: "€",
  usd: "$",
  aed: "AED ",
  pln: "zł ",
};

function formatMinor(amount: number, currency: string): string {
  const symbol = SYMBOL[currency.toLowerCase()] ?? `${currency.toUpperCase()} `;
  const major = minorToMajor(amount, currency);
  const formatted =
    major < 10000
      ? major.toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : Math.round(major).toLocaleString("en-GB");
  return `${symbol}${formatted}`;
}

function formatTotalFees(
  fees: Array<{ currency: string; totalMinorUnits: number }>
): string {
  return fees
    .map((f) => formatMinor(f.totalMinorUnits, f.currency))
    .join(" · ");
}
