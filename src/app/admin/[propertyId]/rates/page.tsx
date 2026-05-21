"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface CancellationPolicy {
  deadlineHours?: number;
  penaltyType?: "first_night" | "full_stay" | "percent" | "none";
  penaltyPercent?: number;
  note?: string;
}

interface RatePlan {
  id: string;
  otaRateId: string;
  name: string;
  namePublic: string | null;
  isPublic: boolean | null;
  isRefundable: boolean | null;
  cancellationPolicy: CancellationPolicy | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  roomTypeOtaId: string | null;
}

const PENALTY_TYPES: Array<{ value: CancellationPolicy["penaltyType"]; label: string }> = [
  { value: "none", label: "None — full refund" },
  { value: "first_night", label: "First night" },
  { value: "full_stay", label: "Full stay" },
  { value: "percent", label: "Percentage" },
];

export default function RatesPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [list, setList] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/admin/properties/${propertyId}/rate-plans`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { ratePlans: RatePlan[] };
      setList(d.ratePlans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, propertyId]);

  return (
    <>
      <TopStrip
        title="Rate plans"
        subtitle={
          loading
            ? "Loading…"
            : `${list.length} rate ${list.length === 1 ? "plan" : "plans"} · synced from Cloudbeds · toggle visibility, edit refundability + cancellation policy`
        }
        actions={
          <Btn href={`/admin/${propertyId}/cloudbeds`}>
            Re-sync from Cloudbeds
          </Btn>
        }
      />

      {loading && list.length === 0 ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : error ? (
        <div className="text-[13px]" style={{ color: "var(--a-red)" }}>
          {error}
        </div>
      ) : list.length === 0 ? (
        <div
          className="border rounded-md p-12 text-center text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
        >
          No rate plans yet. Run a Cloudbeds sync to populate.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((rp) => (
            <RatePlanRow
              key={rp.id}
              plan={rp}
              open={openId === rp.id}
              onToggle={() => setOpenId(openId === rp.id ? null : rp.id)}
              onSaved={(updated) => {
                setList((cur) =>
                  cur.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
                );
              }}
              propertyId={propertyId}
              token={token}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
        CB-side rate name &amp; price stay authoritative — admin only edits display + policy.
        Supporting note &amp; inclusions land when those columns are added to the schema.
      </p>
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────

function RatePlanRow({
  plan,
  open,
  onToggle,
  onSaved,
  propertyId,
  token,
}: {
  plan: RatePlan;
  open: boolean;
  onToggle: () => void;
  onSaved: (rp: RatePlan) => void;
  propertyId: string;
  token: string;
}) {
  const [savingPublic, setSavingPublic] = useState(false);
  const isShown = plan.isPublic !== false;

  async function togglePublic() {
    if (savingPublic) return;
    const next = !isShown;
    setSavingPublic(true);
    onSaved({ ...plan, isPublic: next }); // optimistic
    try {
      const r = await fetch(
        `/api/admin/properties/${propertyId}/rate-plans/${plan.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isPublic: next }),
        }
      );
      if (!r.ok) onSaved({ ...plan, isPublic: isShown }); // revert
    } catch {
      onSaved({ ...plan, isPublic: isShown }); // revert
    } finally {
      setSavingPublic(false);
    }
  }

  return (
    <div
      className="border rounded-md overflow-hidden"
      style={{
        borderColor: open ? "var(--a-accent)" : "var(--a-border)",
        background: "var(--a-surface)",
        opacity: isShown ? 1 : 0.6,
      }}
    >
      <div className="w-full px-3.5 py-2.5 flex items-center gap-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-3 text-left flex-1 min-w-0 hover:opacity-80"
        >
          <span
            className="text-[11px]"
            style={{
              color: "var(--a-muted)",
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform .15s",
            }}
          >
            ›
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{plan.name}</div>
            <div
              className="font-jbm text-[11px] mt-0.5 truncate"
              style={{ color: "var(--a-muted)" }}
            >
              {plan.roomTypeName ? `${plan.roomTypeName} · ` : ""}CB rateID{" "}
              {plan.otaRateId}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {plan.isRefundable === false ? (
            <Pill tone="gray">non-refundable</Pill>
          ) : (
            <Pill tone="green">refundable</Pill>
          )}
          {plan.cancellationPolicy?.deadlineHours !== undefined && (
            <Pill tone="blue">{plan.cancellationPolicy.deadlineHours}h deadline</Pill>
          )}
          <button
            onClick={togglePublic}
            disabled={savingPublic}
            title={
              isShown
                ? "Shown in the booking engine — click to hide"
                : "Hidden from the booking engine — click to show"
            }
            className="text-[11px] px-2 py-0.5 rounded border font-medium"
            style={
              isShown
                ? {
                    borderColor: "rgba(0,135,90,0.25)",
                    color: "var(--a-green)",
                    background: "var(--a-green-soft)",
                  }
                : {
                    borderColor: "var(--a-border)",
                    color: "var(--a-muted)",
                    background: "var(--a-surface-2)",
                  }
            }
          >
            {savingPublic ? "…" : isShown ? "Shown" : "Hidden"}
          </button>
        </div>
      </div>
      {open && (
        <Editor
          plan={plan}
          propertyId={propertyId}
          token={token}
          onSaved={(updated) => {
            onSaved(updated);
            onToggle();
          }}
        />
      )}
    </div>
  );
}

// ─── Editor ─────────────────────────────────────────────────────

function Editor({
  plan,
  propertyId,
  token,
  onSaved,
}: {
  plan: RatePlan;
  propertyId: string;
  token: string;
  onSaved: (rp: RatePlan) => void;
}) {
  const [isRefundable, setIsRefundable] = useState<boolean>(
    plan.isRefundable ?? true
  );
  const [deadlineHours, setDeadlineHours] = useState<string>(
    plan.cancellationPolicy?.deadlineHours?.toString() ?? "48"
  );
  const [penaltyType, setPenaltyType] = useState<
    NonNullable<CancellationPolicy["penaltyType"]>
  >(plan.cancellationPolicy?.penaltyType ?? "first_night");
  const [penaltyPercent, setPenaltyPercent] = useState<string>(
    plan.cancellationPolicy?.penaltyPercent?.toString() ?? "100"
  );
  const [note, setNote] = useState<string>(
    plan.cancellationPolicy?.note ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const policy: CancellationPolicy | null = isRefundable
        ? {
            deadlineHours: deadlineHours
              ? parseInt(deadlineHours, 10)
              : undefined,
            penaltyType,
            penaltyPercent:
              penaltyType === "percent" && penaltyPercent
                ? parseInt(penaltyPercent, 10)
                : undefined,
            note: note.trim() || undefined,
          }
        : note.trim()
          ? { note: note.trim() }
          : null;

      const r = await fetch(
        `/api/admin/properties/${propertyId}/rate-plans/${plan.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            isRefundable,
            cancellationPolicy: policy,
          }),
        }
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setSavedAt(Date.now());
      onSaved({ ...plan, isRefundable, cancellationPolicy: policy });
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="px-3.5 py-3 border-t"
      style={{ borderColor: "var(--a-border-soft)", background: "var(--a-surface-2)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Refundable">
          <select
            value={isRefundable ? "yes" : "no"}
            onChange={(e) => setIsRefundable(e.target.value === "yes")}
            className="w-full px-2 py-1 border rounded text-[12.5px]"
            style={{ borderColor: "var(--a-border)", background: "white" }}
          >
            <option value="yes">Yes — guest can cancel</option>
            <option value="no">No — non-refundable</option>
          </select>
        </Field>
        <Field
          label="Free-cancel deadline"
          hint="hours before arrival; guest can cancel up to this point for free"
        >
          <input
            type="number"
            min={0}
            value={deadlineHours}
            onChange={(e) => setDeadlineHours(e.target.value)}
            disabled={!isRefundable}
            className="w-full px-2 py-1 border rounded text-[12.5px] font-jbm disabled:opacity-50"
            style={{ borderColor: "var(--a-border)", background: "white" }}
          />
        </Field>
        <Field
          label="Penalty after deadline"
          hint="charged if guest cancels after the deadline"
        >
          <select
            value={penaltyType}
            onChange={(e) =>
              setPenaltyType(
                e.target.value as NonNullable<CancellationPolicy["penaltyType"]>
              )
            }
            disabled={!isRefundable}
            className="w-full px-2 py-1 border rounded text-[12.5px] disabled:opacity-50"
            style={{ borderColor: "var(--a-border)", background: "white" }}
          >
            {PENALTY_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Percent (if percent)"
          hint="0–100"
        >
          <input
            type="number"
            min={0}
            max={100}
            value={penaltyPercent}
            onChange={(e) => setPenaltyPercent(e.target.value)}
            disabled={!isRefundable || penaltyType !== "percent"}
            className="w-full px-2 py-1 border rounded text-[12.5px] font-jbm disabled:opacity-50"
            style={{ borderColor: "var(--a-border)", background: "white" }}
          />
        </Field>
        <div className="md:col-span-2">
          <Field
            label="Internal note (optional)"
            hint="for admin reference; not shown to guests"
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-2 py-1 border rounded text-[12.5px]"
              style={{ borderColor: "var(--a-border)", background: "white" }}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Btn variant="primary" size="sm" onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Btn>
        {error && (
          <span className="text-[11.5px]" style={{ color: "var(--a-red)" }}>
            {error}
          </span>
        )}
        {savedAt && !error && (
          <span className="text-[11.5px]" style={{ color: "var(--a-green)" }}>
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[11.5px] font-medium mb-1"
        style={{ color: "var(--a-ink-2)" }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-[11px] mt-1" style={{ color: "var(--a-muted)" }}>
          {hint}
        </div>
      )}
    </div>
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
