"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn, Crumb } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../../layout";

interface TemplateRow {
  key: string;
  name: string;
  isTransactional: boolean;
  status: "active" | "draft" | "disabled";
}

interface ScheduleRow {
  templateKey: string;
  enabled: boolean;
  trigger: "arrival" | "checkout";
  offsetDays: number;
  timeOfDay: string;
  audience: "all" | "flex" | "nr" | "min_nights_2";
  // Stats kept in component state for the optional "X sent · 7d" pill.
}

const OFFSETS: Array<{ value: number; label: string }> = [
  { value: -7, label: "7 days before" },
  { value: -5, label: "5 days before" },
  { value: -3, label: "3 days before" },
  { value: -2, label: "2 days before" },
  { value: -1, label: "1 day before" },
  { value: 0, label: "same day" },
  { value: 1, label: "1 day after" },
  { value: 2, label: "2 days after" },
  { value: 3, label: "3 days after" },
];

const AUDIENCE_OPTS = [
  { value: "all", label: "all guests" },
  { value: "flex", label: "Flex only" },
  { value: "nr", label: "NR only" },
  { value: "min_nights_2", label: "stays ≥ 2 nights" },
];

export default function SchedulePage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [draft, setDraft] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
        setDraft(s);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  function update(templateKey: string, patch: Partial<ScheduleRow>) {
    setDraft((d) =>
      d.map((s) => (s.templateKey === templateKey ? { ...s, ...patch } : s))
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/properties/${propertyId}/email-schedules`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ schedules: draft }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setSchedules(draft);
      setSavedAt(Date.now());
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(schedules);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(schedules);

  // Only non-transactional templates appear here. Transactional ones fire from
  // booking events directly, not the scheduler.
  const automatedTemplates = templates.filter((t) => !t.isTransactional);

  return (
    <div>
      <TopStrip
        title={
          <>
            <Crumb to={`/admin/${propertyId}/emails`}>Emails</Crumb>
            Schedule
          </>
        }
        subtitle="Triggers run hourly · times in property timezone"
        actions={
          <>
            <Btn onClick={discard} variant="ghost">
              Discard
            </Btn>
            <Btn variant="primary" onClick={save}>
              {saving ? "Saving…" : "Save"}
            </Btn>
          </>
        }
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
      {savedAt && !dirty && (
        <div
          className="mb-4 p-2.5 rounded text-[12.5px]"
          style={{
            background: "var(--a-green-soft)",
            color: "var(--a-green)",
            border: "1px solid rgba(0,135,90,0.2)",
          }}
        >
          Saved.
        </div>
      )}

      <div
        className="mb-5 p-3 rounded flex gap-2 items-start text-[12px]"
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
          Automated emails fire from booking timeline (arrival, checkout). One-off broadcasts are not supported. The cron runs hourly.
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
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ borderBottom: "1px solid var(--a-border-soft)" }}
        >
          <h2 className="text-[12.5px] font-semibold">Active triggers</h2>
          <span className="text-[11.5px]" style={{ color: "var(--a-muted)" }}>
            {loading
              ? "loading…"
              : `${draft.filter((s) => s.enabled).length} enabled · ${draft.length} total`}
          </span>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
            Loading…
          </div>
        ) : draft.length === 0 ? (
          <div className="px-4 py-6 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
            No automated templates yet. Templates with a `defaultSchedule` get seeded automatically when you visit Emails.
          </div>
        ) : (
          draft.map((s) => {
            const tpl = automatedTemplates.find((t) => t.key === s.templateKey);
            const name = tpl?.name ?? s.templateKey;
            return (
              <div
                key={s.templateKey}
                className="px-4 py-3 flex items-center gap-2.5 flex-wrap"
                style={{ borderBottom: "1px solid var(--a-border-soft)" }}
              >
                <Toggle
                  on={s.enabled}
                  onClick={() => update(s.templateKey, { enabled: !s.enabled })}
                />
                <span className="font-medium text-[13px]" style={{ minWidth: 180 }}>
                  {name}
                </span>
                <span className="text-[12.5px]" style={{ color: "var(--a-ink-2)" }}>
                  fire
                </span>
                <Select
                  value={String(s.offsetDays)}
                  onChange={(v) => update(s.templateKey, { offsetDays: Number(v) })}
                  options={OFFSETS.map((o) => ({ value: String(o.value), label: o.label }))}
                />
                <span className="text-[12.5px]" style={{ color: "var(--a-ink-2)" }}>
                </span>
                <Select
                  value={s.trigger}
                  onChange={(v) => update(s.templateKey, { trigger: v as "arrival" | "checkout" })}
                  options={[
                    { value: "arrival", label: "arrival" },
                    { value: "checkout", label: "checkout" },
                  ]}
                />
                <span className="text-[12.5px]" style={{ color: "var(--a-ink-2)" }}>
                  at
                </span>
                <input
                  type="text"
                  value={s.timeOfDay}
                  onChange={(e) => update(s.templateKey, { timeOfDay: e.target.value })}
                  placeholder="09:00"
                  className="px-2.5 py-1 border rounded text-[12.5px] focus:outline-none focus:border-[var(--a-accent)]"
                  style={{ borderColor: "var(--a-border)", width: 70 }}
                />
                <span className="text-[12.5px]" style={{ color: "var(--a-muted)" }}>
                  ·
                </span>
                <Select
                  value={s.audience}
                  onChange={(v) => update(s.templateKey, { audience: v as ScheduleRow["audience"] })}
                  options={AUDIENCE_OPTS}
                />
                <div className="ml-auto flex gap-1.5 items-center">
                  <Btn
                    size="sm"
                    variant="ghost"
                    href={`/admin/${propertyId}/emails/template/${s.templateKey}`}
                  >
                    Edit template ↗
                  </Btn>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      role="button"
      className="inline-block"
      style={{
        width: 32,
        height: 18,
        borderRadius: 999,
        background: on ? "var(--a-accent)" : "#E5E5E5",
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
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
          left: on ? 16 : 2,
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          transition: "left 0.12s",
        }}
      />
    </span>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1 border rounded text-[12.5px] focus:outline-none focus:border-[var(--a-accent)]"
      style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
