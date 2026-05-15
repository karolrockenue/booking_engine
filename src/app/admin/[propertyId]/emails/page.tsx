"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface TemplateRow {
  id: string;
  key: string;
  name: string;
  subject: string;
  status: "active" | "draft" | "disabled";
  isTransactional: boolean;
  updatedAt: string;
  stats: { total: number; opens: number };
}

interface ScheduleRow {
  templateKey: string;
  enabled: boolean;
  trigger: "arrival" | "checkout";
  offsetDays: number;
  timeOfDay: string;
  audience: string;
}

const TRIGGER_LABEL = (s: ScheduleRow) => {
  if (s.offsetDays === 0) return `${s.trigger} · ${s.timeOfDay}`;
  const word = Math.abs(s.offsetDays) === 1 ? "day" : "days";
  const dir = s.offsetDays < 0 ? "before" : "after";
  return `${Math.abs(s.offsetDays)} ${word} ${dir} ${s.trigger} · ${s.timeOfDay}`;
};

export default function EmailsListPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const router = useRouter();
  const token = useAdminToken();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/properties/${propertyId}/email-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
      fetch(`/api/admin/properties/${propertyId}/email-schedules`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText))),
    ])
      .then(([t, s]) => {
        setTemplates(t.templates ?? t);
        setSchedules(s);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  const scheduleByKey = new Map(schedules.map((s) => [s.templateKey, s]));

  async function toggleEnabled(templateKey: string) {
    const next = schedules.map((s) =>
      s.templateKey === templateKey ? { ...s, enabled: !s.enabled } : s
    );
    setSchedules(next);
    await fetch(`/api/admin/properties/${propertyId}/email-schedules`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ schedules: next }),
    });
  }

  return (
    <div>
      <TopStrip
        title="Emails"
        subtitle="Booking confirmations, cancellations, and scheduled guest comms"
        actions={
          <>
            <Btn href={`/admin/${propertyId}/emails/log`}>Send log</Btn>
            <Btn href={`/admin/${propertyId}/emails/schedule`}>Schedule</Btn>
          </>
        }
      />

      {error && (
        <div
          className="mb-4 p-3 rounded text-[12.5px]"
          style={{
            background: "var(--a-red-soft)",
            color: "var(--a-red)",
            border: "1px solid rgba(198,40,40,0.2)",
          }}
        >
          {error}
        </div>
      )}

      <Card
        title="Templates"
        meta={
          loading
            ? "loading…"
            : `${templates.length} templates · ${templates.filter((t) => scheduleByKey.get(t.key)?.enabled).length} scheduled`
        }
      >
        <div
          className="grid items-center px-4 py-2 text-[10.5px] uppercase tracking-wider font-medium"
          style={{
            gridTemplateColumns: "1fr 220px 110px 80px 80px 70px",
            gap: 16,
            color: "var(--a-muted)",
            background: "var(--a-surface-2)",
            borderBottom: "1px solid var(--a-border-soft)",
          }}
        >
          <div>Template</div>
          <div>Trigger</div>
          <div>Last edited</div>
          <div style={{ textAlign: "right" }}>Sent · 7d</div>
          <div style={{ textAlign: "right" }}>Open</div>
          <div style={{ textAlign: "center" }}>On</div>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
            Loading…
          </div>
        ) : (
          templates.map((t) => {
            const sched = scheduleByKey.get(t.key);
            const openRate = t.stats.total > 0
              ? `${Math.round((t.stats.opens / t.stats.total) * 100)}%`
              : "—";
            const triggerLabel = sched
              ? TRIGGER_LABEL(sched)
              : t.isTransactional
                ? `${t.key}.event`
                : "no schedule";
            return (
              <button
                key={t.id}
                onClick={() => router.push(`/admin/${propertyId}/emails/template/${t.key}`)}
                className="grid items-center w-full text-left px-4 py-3"
                style={{
                  gridTemplateColumns: "1fr 220px 110px 80px 80px 70px",
                  gap: 16,
                  borderBottom: "1px solid var(--a-border-soft)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--a-surface-2)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div>
                  <div className="text-[13px] font-medium">{t.name}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--a-muted)" }}>
                    {t.isTransactional ? "Transactional" : "Automated"}
                    {t.status === "draft" && (
                      <span
                        className="ml-2 inline-flex items-center gap-1 px-1.5 py-0 rounded font-jbm"
                        style={{
                          fontSize: 10,
                          color: "var(--a-muted)",
                          background: "#F5F5F5",
                          border: "1px solid var(--a-border)",
                        }}
                      >
                        draft
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-jbm text-[11.5px]" style={{ color: "var(--a-ink-2)" }}>
                  {triggerLabel}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--a-muted)" }}>
                  {formatRelative(t.updatedAt)}
                </div>
                <div
                  className="font-jbm text-[11.5px]"
                  style={{ color: "var(--a-ink-2)", textAlign: "right" }}
                >
                  {t.stats.total || "—"}
                </div>
                <div
                  className="font-jbm text-[11.5px]"
                  style={{ color: "var(--a-ink-2)", textAlign: "right" }}
                >
                  {openRate}
                </div>
                <div style={{ textAlign: "center" }}>
                  {sched ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEnabled(t.key);
                      }}
                      role="button"
                      className="inline-block"
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 999,
                        background: sched.enabled ? "var(--a-accent)" : "#E5E5E5",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: "#fff",
                          top: 2,
                          left: sched.enabled ? 16 : 2,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                          transition: "left 0.12s",
                        }}
                      />
                    </span>
                  ) : (
                    <span
                      className="font-jbm text-[10.5px]"
                      style={{ color: "var(--a-muted)" }}
                    >
                      —
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </Card>

      <div
        className="mt-5 p-3 rounded flex gap-2 items-start text-[12px]"
        style={{
          background: "var(--a-accent-soft)",
          border: "1px solid rgba(91,91,214,0.2)",
        }}
      >
        <span
          className="inline-flex items-center justify-center text-white font-semibold text-[11px] flex-shrink-0"
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--a-accent)",
          }}
        >
          i
        </span>
        <span style={{ color: "var(--a-ink-2)" }}>
          Templates render with this property&apos;s branding. Variables like{" "}
          <code
            className="font-jbm text-[11.5px]"
            style={{ color: "var(--a-accent)" }}
          >
            {"{{guest.firstName}}"}
          </code>{" "}
          and{" "}
          <code
            className="font-jbm text-[11.5px]"
            style={{ color: "var(--a-accent)" }}
          >
            {"{{booking.checkIn}}"}
          </code>{" "}
          are substituted at send time.
        </span>
      </div>
    </div>
  );
}

function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        background: "var(--a-surface)",
        border: "1px solid var(--a-border)",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderBottom: "1px solid var(--a-border-soft)" }}
      >
        <h2 className="text-[12.5px] font-semibold">{title}</h2>
        {meta && (
          <span className="text-[11.5px]" style={{ color: "var(--a-muted)" }}>
            {meta}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
