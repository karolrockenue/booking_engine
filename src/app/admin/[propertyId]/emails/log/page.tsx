"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn, Crumb } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../../layout";

interface SendRow {
  id: string;
  templateKey: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  bouncedAt: string | null;
  bookingId: string | null;
  createdAt: string;
  errorMessage: string | null;
}

const STATUS_TONE: Record<string, "green" | "gray" | "red" | "amber"> = {
  queued: "gray",
  sent: "gray",
  delivered: "gray",
  opened: "green",
  clicked: "green",
  bounced: "red",
  dropped: "red",
  failed: "red",
  deferred: "amber",
};

export default function EmailLogPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();
  const [rows, setRows] = useState<SendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    fetch(`/api/admin/properties/${propertyId}/email-sends?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setRows)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.templateKey !== templateFilter) return false;
      return true;
    });
  }, [rows, statusFilter, templateFilter]);

  const templateKeys = Array.from(new Set(rows.map((r) => r.templateKey))).sort();

  const stats = useMemo(() => {
    const total = rows.length;
    const delivered = rows.filter((r) =>
      ["delivered", "opened", "clicked"].includes(r.status)
    ).length;
    const opened = rows.filter((r) => ["opened", "clicked"].includes(r.status)).length;
    const bounced = rows.filter((r) => ["bounced", "dropped", "failed"].includes(r.status)).length;
    return {
      total,
      deliveredPct: total ? Math.round((delivered / total) * 100) : 0,
      openedPct: total ? Math.round((opened / total) * 100) : 0,
      bouncedPct: total ? Math.round((bounced / total) * 100) : 0,
    };
  }, [rows]);

  return (
    <div>
      <TopStrip
        title={
          <>
            <Crumb to={`/admin/${propertyId}/emails`}>Emails</Crumb>
            Send log
          </>
        }
        subtitle="Last 200 sends · live from SendGrid Event Webhook"
        actions={<Btn size="sm">⤓ Export CSV</Btn>}
      />

      {error && (
        <div
          className="mb-4 p-2.5 rounded text-[12.5px]"
          style={{
            background: "var(--a-red-soft)",
            color: "var(--a-red)",
            border: "1px solid rgba(198,40,40,0.2)",
          }}
        >
          {error}
        </div>
      )}

      <div
        className="grid mb-5 rounded-md overflow-hidden"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          background: "var(--a-surface)",
          border: "1px solid var(--a-border)",
        }}
      >
        <Stat label="Total" value={String(stats.total)} delta="last 200" />
        <Stat label="Delivered" value={`${stats.deliveredPct}%`} delta="of total" />
        <Stat label="Opened" value={`${stats.openedPct}%`} delta="of total" />
        <Stat label="Bounced" value={`${stats.bouncedPct}%`} delta="of total" />
      </div>

      <div className="flex gap-2 items-center mb-3 flex-wrap">
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          className="px-2.5 py-1 border rounded text-[12.5px]"
          style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
        >
          <option value="all">All templates</option>
          {templateKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1 border rounded text-[12.5px]"
          style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="opened">Opened</option>
          <option value="bounced">Bounced</option>
          <option value="dropped">Dropped</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-[11.5px] ml-auto" style={{ color: "var(--a-muted)" }}>
          showing {filtered.length} of {rows.length}
        </span>
      </div>

      <div
        className="rounded-md overflow-hidden"
        style={{
          background: "var(--a-surface)",
          border: "1px solid var(--a-border)",
        }}
      >
        <div
          className="grid items-center px-4 py-2 text-[10.5px] uppercase tracking-wider font-medium"
          style={{
            gridTemplateColumns: "110px 200px 1fr 140px 110px 90px",
            gap: 16,
            color: "var(--a-muted)",
            background: "var(--a-surface-2)",
            borderBottom: "1px solid var(--a-border-soft)",
          }}
        >
          <div>Sent</div>
          <div>Guest</div>
          <div>Subject</div>
          <div>Template</div>
          <div>From</div>
          <div style={{ textAlign: "right" }}>Status</div>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
            No sends yet.
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="grid items-center px-4 py-2.5"
              style={{
                gridTemplateColumns: "110px 200px 1fr 140px 110px 90px",
                gap: 16,
                fontSize: 12.5,
                borderBottom: "1px solid var(--a-border-soft)",
              }}
            >
              <div className="font-jbm text-[11.5px]" style={{ color: "var(--a-muted)" }}>
                {formatRelative(r.sentAt ?? r.createdAt)}
              </div>
              <div>
                <div className="font-medium">{r.toEmail}</div>
              </div>
              <div className="truncate">{r.subject}</div>
              <div>
                <Pill tone="blue">{r.templateKey}</Pill>
              </div>
              <div className="font-jbm text-[11px]" style={{ color: "var(--a-muted)" }}>
                {r.fromEmail.split("@")[0]}
              </div>
              <div style={{ textAlign: "right" }}>
                <Pill tone={STATUS_TONE[r.status] ?? "gray"}>{r.status}</Pill>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div
      className="px-4 py-3.5"
      style={{ borderRight: "1px solid var(--a-border-soft)" }}
    >
      <div className="text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--a-muted)" }}>
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: "var(--a-accent)" }}
        />
        {label}
      </div>
      <div
        className="text-[22px] font-semibold tracking-tight mt-1"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="text-[11px] font-jbm mt-0.5" style={{ color: "var(--a-muted)" }}>
        {delta}
      </div>
    </div>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "green" | "gray" | "red" | "amber" | "blue";
  children: React.ReactNode;
}) {
  const map = {
    green: { color: "var(--a-green)", bg: "var(--a-green-soft)", border: "rgba(0,135,90,0.25)" },
    gray: { color: "var(--a-muted)", bg: "#F5F5F5", border: "var(--a-border)" },
    red: { color: "var(--a-red)", bg: "var(--a-red-soft)", border: "rgba(198,40,40,0.25)" },
    amber: { color: "var(--a-amber)", bg: "var(--a-amber-soft)", border: "rgba(180,83,9,0.25)" },
    blue: { color: "var(--a-accent)", bg: "var(--a-accent-soft)", border: "rgba(91,91,214,0.25)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0 rounded font-jbm text-[10.5px] font-medium"
      style={{ color: map.color, background: map.bg, border: `1px solid ${map.border}` }}
    >
      <span className="w-1 h-1 rounded-full inline-block" style={{ background: "currentColor" }} />
      {children}
    </span>
  );
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.round((now - d.getTime()) / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)}h`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
