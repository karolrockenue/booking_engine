"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../layout";

interface OverviewData {
  property: {
    id: string;
    slug: string;
    name: string;
    domain: string | null;
    currency: string | null;
    status: string | null;
    ryftAccountId: string | null;
    ryftAccountStatus: string | null;
    cloudbedsConnected: boolean;
    cloudbedsPropertyId: string | null;
  };
  stats: {
    bookings7d: number;
    bookings7dPrior: number;
    bookingsDelta: number;
    revenue7d: number;
    revenue7dPrior: number;
    revenueDeltaPct: number | null;
    avgBooking: number;
    avgNights: number;
    dailyCounts: number[];
    dailyRevenue: number[];
  };
  recentBookings: Array<{
    id: string;
    orderId: string;
    cloudbedsReservationId: string | null;
    guestFirst: string;
    guestLast: string;
    checkIn: string;
    checkOut: string;
    grandTotal: string;
    currency: string;
    status: string;
    rateType: string | null;
    createdAt: string;
    roomTypeName: string | null;
    ratePlanName: string | null;
  }>;
  checklist: Array<{ id: string; label: string; done: boolean; meta?: string }>;
  alerts: Array<{
    id: string;
    kind: "danger" | "warn" | "info";
    title: string;
    desc: string;
    cta?: { label: string; href?: string };
  }>;
}

export default function OverviewPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/properties/${propertyId}/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message ?? "failed to load"))
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  if (loading && !data) {
    return (
      <>
        <TopStrip title="Overview" subtitle="Loading…" />
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopStrip title="Overview" subtitle="Failed to load" />
        <div
          className="border rounded-md p-6 text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-red)" }}
        >
          {error}
        </div>
      </>
    );
  }

  if (!data) return null;

  const { property: p, stats, recentBookings, checklist, alerts } = data;
  const currency = p.currency ?? "GBP";
  // Ryft has no per-account deep link we can rely on; point at our own admin
  // Ryft page, which surfaces onboarding/connection status.
  const ryftUrl = `/admin/${propertyId}/ryft`;
  const siteUrl = p.domain ? `https://${p.domain}` : `/?property=${p.slug}`;

  return (
    <>
      <TopStrip
        title="Overview"
        badge={
          p.status === "live"
            ? { text: "live", tone: "green" }
            : p.status === "paused"
              ? { text: "paused", tone: "amber" }
              : { text: "draft", tone: "blue" }
        }
        subtitle={`${p.domain ?? p.slug} · ${currency}`}
        actions={<Btn variant="primary">Sync now</Btn>}
      />

      {/* Stat grid */}
      <div
        className="grid grid-cols-2 lg:grid-cols-4 border rounded-md overflow-hidden mb-5"
        style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
      >
        <Stat
          label="Bookings · 7d"
          value={stats.bookings7d.toString()}
          delta={renderDeltaCount(stats.bookingsDelta, stats.bookings7dPrior)}
          spark={stats.dailyCounts}
        />
        <Stat
          label="Revenue · 7d"
          value={formatMoney(stats.revenue7d, currency)}
          delta={renderDeltaPct(stats.revenueDeltaPct)}
          spark={stats.dailyRevenue}
        />
        <Stat
          label="Avg booking"
          value={
            stats.avgBooking ? formatMoney(stats.avgBooking, currency) : "—"
          }
          delta={
            stats.avgNights
              ? `${stats.avgNights.toFixed(1)} nights avg`
              : "no bookings yet"
          }
        />
        <Stat
          label="Failed · 7d"
          value={stats.bookings7d > 0 ? "0" : "—"}
          delta={
            alerts.find((a) => a.id === "failed_bookings")?.title ??
            "no failures"
          }
          tone={
            alerts.find((a) => a.id === "failed_bookings") ? "amber" : "default"
          }
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="flex flex-col gap-4">
          <RecentBookingsCard bookings={recentBookings} propertyId={p.id} />
          <NeedsAttentionCard alerts={alerts} ryftUrl={ryftUrl} propertyId={p.id} />
        </div>
        <div className="flex flex-col gap-4">
          <ChecklistCard checklist={checklist} />
          <QuickActionsCard
            propertyId={p.id}
            siteUrl={siteUrl}
            ryftUrl={ryftUrl}
          />
        </div>
      </div>
    </>
  );
}

// ─── Stat ──────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  delta,
  spark,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
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
            background:
              tone === "amber" ? "var(--a-amber)" : "var(--a-accent)",
          }}
        />
        {label}
      </div>
      <div className="text-[24px] font-semibold tracking-tight mt-1 tabular-nums">
        {value}
      </div>
      <div
        className="text-[11.5px] mt-0.5 font-jbm"
        style={{ color: "var(--a-muted)" }}
      >
        {delta}
      </div>
      {spark && spark.some((v) => v > 0) && <Sparkline values={spark} />}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-5 mt-2">
      {values.map((v, i) => {
        const lit = i >= values.length - 2 && v > 0;
        const h = Math.max(2, (v / max) * 100);
        return (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              background: "var(--a-accent)",
              opacity: lit ? 1 : 0.15,
              height: `${h}%`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Recent bookings ────────────────────────────────────────────────

function RecentBookingsCard({
  bookings,
  propertyId,
}: {
  bookings: OverviewData["recentBookings"];
  propertyId: string;
}) {
  return (
    <Card>
      <CardHead>
        <h2 className="text-[12.5px] font-semibold">Recent bookings</h2>
        <Link
          href={`/admin/${propertyId}/bookings`}
          className="ml-auto text-[11.5px]"
          style={{ color: "var(--a-accent)" }}
        >
          All bookings →
        </Link>
      </CardHead>
      {bookings.length === 0 ? (
        <div
          className="px-4 py-8 text-center text-[12.5px]"
          style={{ color: "var(--a-muted)" }}
        >
          No bookings yet for this property.
        </div>
      ) : (
        bookings.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-3 px-4 py-2.5 text-[12.5px] border-b last:border-b-0"
            style={{ borderColor: "var(--a-border-soft)" }}
          >
            <span
              className="font-jbm text-[11.5px] w-[110px] flex-shrink-0"
              style={{ color: "var(--a-ink-2)" }}
            >
              {b.cloudbedsReservationId ?? "—"}
            </span>
            <span className="flex-1 truncate">
              {b.guestFirst} {b.guestLast}
              {b.roomTypeName && (
                <span style={{ color: "var(--a-muted)" }}> · {b.roomTypeName}</span>
              )}
            </span>
            <span className="font-jbm tabular-nums">
              {formatMoney(Number(b.grandTotal), b.currency)}
            </span>
            <StatusPill status={b.status} />
          </div>
        ))
      )}
    </Card>
  );
}

// ─── Needs attention ────────────────────────────────────────────────

function NeedsAttentionCard({
  alerts,
  ryftUrl,
  propertyId,
}: {
  alerts: OverviewData["alerts"];
  ryftUrl: string;
  propertyId: string;
}) {
  return (
    <Card>
      <CardHead>
        <h2 className="text-[12.5px] font-semibold">Needs attention</h2>
        {alerts.length > 0 ? (
          <span
            className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10.5px] border"
            style={{
              color: "var(--a-amber)",
              background: "var(--a-amber-soft)",
              borderColor: "rgba(180,83,9,0.25)",
            }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: "currentColor" }}
            />
            {alerts.length} item{alerts.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span
            className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10.5px] border"
            style={{
              color: "var(--a-green)",
              background: "var(--a-green-soft)",
              borderColor: "rgba(0,135,90,0.25)",
            }}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: "currentColor" }}
            />
            0 alerts
          </span>
        )}
      </CardHead>
      {alerts.length === 0 ? (
        <div
          className="px-4 py-8 text-center text-[12.5px]"
          style={{ color: "var(--a-muted)" }}
        >
          All clear.
        </div>
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 px-4 py-3 text-[12.5px] border-b last:border-b-0"
            style={{ borderColor: "var(--a-border-soft)" }}
          >
            <span
              className="w-[18px] h-[18px] flex items-center justify-center rounded-[3px] text-[10px] font-bold flex-shrink-0"
              style={{
                background:
                  a.kind === "danger" ? "var(--a-red-soft)" : "var(--a-amber-soft)",
                color: a.kind === "danger" ? "var(--a-red)" : "var(--a-amber)",
              }}
            >
              !
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{a.title}</div>
              <div
                className="text-[11.5px] mt-0.5"
                style={{ color: "var(--a-muted)" }}
              >
                {a.desc}
              </div>
            </div>
            {a.cta && (
              <Btn
                size="sm"
                href={
                  a.id === "ryft_restricted"
                    ? ryftUrl
                    : a.id === "cloudbeds_reauth"
                      ? `/admin/${propertyId}/cloudbeds`
                      : undefined
                }
              >
                {a.cta.label}
              </Btn>
            )}
          </div>
        ))
      )}
    </Card>
  );
}

// ─── Checklist ──────────────────────────────────────────────────────

function ChecklistCard({
  checklist,
}: {
  checklist: OverviewData["checklist"];
}) {
  const done = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  const allDone = done === total;
  return (
    <Card>
      <CardHead>
        <h2 className="text-[12.5px] font-semibold">Launch checklist</h2>
        <span
          className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10.5px] border"
          style={{
            color: allDone ? "var(--a-green)" : "var(--a-amber)",
            background: allDone ? "var(--a-green-soft)" : "var(--a-amber-soft)",
            borderColor: allDone
              ? "rgba(0,135,90,0.25)"
              : "rgba(180,83,9,0.25)",
          }}
        >
          {done}/{total}
        </span>
      </CardHead>
      {checklist.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] border-b last:border-b-0"
          style={{ borderColor: "var(--a-border-soft)" }}
        >
          <span
            className="w-3 h-3 rounded-full inline-flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={
              c.done
                ? { background: "var(--a-ink)", color: "#fff" }
                : {
                    border: "1px dashed #c0c0c0",
                    background: "transparent",
                  }
            }
          >
            {c.done ? "✓" : ""}
          </span>
          <span style={{ color: c.done ? "var(--a-ink-2)" : "var(--a-ink)" }}>
            {c.label}
          </span>
          {c.meta && (
            <span
              className="ml-auto font-jbm text-[11px]"
              style={{ color: "var(--a-muted)" }}
            >
              {c.meta}
            </span>
          )}
        </div>
      ))}
      <div
        className="px-4 py-2 text-[11px]"
        style={{ color: "var(--a-muted)" }}
      >
        Photos · copy · DNS / SSL checks unlock as their tabs ship.
      </div>
    </Card>
  );
}

// ─── Quick actions ──────────────────────────────────────────────────

function QuickActionsCard({
  propertyId,
  siteUrl,
  ryftUrl,
}: {
  propertyId: string;
  siteUrl: string;
  ryftUrl: string;
}) {
  const items: Array<{ label: string; href?: string }> = [
    { label: "Sync inventory", href: `/admin/${propertyId}/cloudbeds` },
    { label: "Manage Ryft", href: ryftUrl },
    { label: "Send test email" },
    { label: "Preview booking flow", href: siteUrl },
  ];
  return (
    <Card>
      <CardHead>
        <h2 className="text-[12.5px] font-semibold">Quick actions</h2>
      </CardHead>
      {items.map((it, i) =>
        it.href ? (
          <a
            key={i}
            href={it.href}
            target={it.href.startsWith("http") ? "_blank" : undefined}
            className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] border-b last:border-b-0 hover:bg-[var(--a-surface-2)]"
            style={{ borderColor: "var(--a-border-soft)" }}
          >
            <span style={{ color: "var(--a-muted)" }}>→</span>
            {it.label}
          </a>
        ) : (
          <div
            key={i}
            className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] border-b last:border-b-0"
            style={{
              borderColor: "var(--a-border-soft)",
              color: "var(--a-muted)",
            }}
          >
            <span>→</span>
            {it.label}
          </div>
        )
      )}
    </Card>
  );
}

// ─── primitives ────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="border rounded-md overflow-hidden"
      style={{
        borderColor: "var(--a-border)",
        background: "var(--a-surface)",
      }}
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: string; label: string }> = {
    paid: { tone: "green", label: "paid" },
    pms_synced: { tone: "green", label: "synced" },
    payment_authorized: { tone: "blue", label: "card on file" },
    pending: { tone: "amber", label: "pending" },
    failed: { tone: "red", label: "failed" },
    cancelled: { tone: "gray", label: "cancelled" },
  };
  const cfg = map[status] ?? { tone: "gray", label: status };
  const tones: Record<string, { color: string; bg: string; border: string }> = {
    green: {
      color: "var(--a-green)",
      bg: "var(--a-green-soft)",
      border: "rgba(0,135,90,0.25)",
    },
    blue: {
      color: "var(--a-accent)",
      bg: "var(--a-accent-soft)",
      border: "rgba(91,91,214,0.25)",
    },
    amber: {
      color: "var(--a-amber)",
      bg: "var(--a-amber-soft)",
      border: "rgba(180,83,9,0.25)",
    },
    red: {
      color: "var(--a-red)",
      bg: "var(--a-red-soft)",
      border: "rgba(198,40,40,0.25)",
    },
    gray: { color: "var(--a-muted)", bg: "#f5f5f5", border: "var(--a-border)" },
  };
  const t = tones[cfg.tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-jbm text-[10.5px] font-medium border"
      style={{ color: t.color, background: t.bg, borderColor: t.border }}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ background: "currentColor" }}
      />
      {cfg.label}
    </span>
  );
}

// ─── formatting ────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
  AED: "AED ",
  PLN: "zł ",
};

function formatMoney(amount: number, currency: string | null): string {
  const symbol = CURRENCY_SYMBOLS[currency ?? "GBP"] ?? `${currency ?? ""} `;
  if (!amount) return `${symbol}0`;
  // Show pennies for individual booking totals, integer for aggregates.
  const useDecimals = amount > 0 && amount < 10000;
  const formatted = useDecimals
    ? amount.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : Math.round(amount).toLocaleString("en-GB");
  return `${symbol}${formatted}`;
}

function renderDeltaCount(delta: number, prior: number): string {
  if (delta === 0 && prior === 0) return "no prior period";
  if (delta === 0) return "unchanged vs prior 7d";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs prior 7d`;
}

function renderDeltaPct(pct: number | null): string {
  if (pct === null) return "no prior period";
  if (pct === 0) return "unchanged";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs prior`;
}
