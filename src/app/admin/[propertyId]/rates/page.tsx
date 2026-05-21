"use client";

import { useEffect, useMemo, useState } from "react";
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
  displayName: string | null;
  isPublic: boolean | null;
  isRefundable: boolean | null;
  cancellationPolicy: CancellationPolicy | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  roomTypeOtaId: string | null;
}

// One logical rate plan (e.g. "Standard", "Non Refundable", "Direct Rate"),
// collapsing the per-room-type rows Cloudbeds returns.
interface RateGroup {
  key: string;
  name: string;
  displayName: string | null;
  plans: RatePlan[];
  isRefundable: boolean;
  isShown: boolean;
  policy: CancellationPolicy | null;
}

const PENALTY_TYPES: Array<{ value: CancellationPolicy["penaltyType"]; label: string }> = [
  { value: "none", label: "None — full refund" },
  { value: "first_night", label: "First night" },
  { value: "full_stay", label: "Full stay" },
  { value: "percent", label: "Percentage" },
];

// Cloudbeds models rate plans per room type. Master/BAR rates come through named
// "<Room type> Standard" (synthesised in the sync), while derived rates (Non
// Refundable, Direct Rate, …) already share one name across rooms. Strip the
// room-type prefix so the "{Room} Standard" rows collapse into a single
// "Standard" logical rate plan.
function logicalName(plan: RatePlan): string {
  const room = (plan.roomTypeName ?? "").trim();
  if (room && plan.name.startsWith(room)) {
    return plan.name.slice(room.length).trim() || plan.name;
  }
  return plan.name;
}

export default function RatesPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [list, setList] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  async function load() {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/properties/${propertyId}/rate-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const groups: RateGroup[] = useMemo(() => {
    const map = new Map<string, RatePlan[]>();
    for (const r of list) {
      const k = logicalName(r);
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return Array.from(map.entries())
      .map(([key, plans]) => ({
        key,
        name: key,
        displayName: plans[0]?.displayName ?? null,
        plans,
        isRefundable: plans[0]?.isRefundable !== false,
        isShown: plans.every((p) => p.isPublic !== false),
        policy: plans[0]?.cancellationPolicy ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [list]);

  // Apply a partial update to every underlying per-room rate plan of a group,
  // so a single admin action (hide, or set policy) lands across all room types.
  async function patchGroup(
    group: RateGroup,
    body: Record<string, unknown>
  ): Promise<boolean> {
    if (!token) return false;
    const ids = new Set(group.plans.map((p) => p.id));
    // optimistic
    setList((cur) => cur.map((r) => (ids.has(r.id) ? { ...r, ...body } : r)));
    const results = await Promise.allSettled(
      group.plans.map((p) =>
        fetch(`/api/admin/properties/${propertyId}/rate-plans/${p.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        })
      )
    );
    if (results.some((r) => r.status === "rejected")) {
      await load(); // re-pull truth on any partial failure
      return false;
    }
    return true;
  }

  return (
    <>
      <TopStrip
        title="Rate plans"
        subtitle={
          loading
            ? "Loading…"
            : `${groups.length} rate ${
                groups.length === 1 ? "plan" : "plans"
              } · synced from Cloudbeds · toggle visibility & edit policy across all room types`
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
      ) : groups.length === 0 ? (
        <div
          className="border rounded-md p-12 text-center text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
        >
          No rate plans yet. Run a Cloudbeds sync to populate.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {groups.map((g) => (
            <GroupRow
              key={g.key}
              group={g}
              open={openKey === g.key}
              onExpand={() => setOpenKey(openKey === g.key ? null : g.key)}
              onPatch={(body) => patchGroup(g, body)}
            />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
        Rate plans are grouped across room types — hiding or editing one applies
        to every room that offers it. CB-side rate name &amp; price stay
        authoritative; admin only edits visibility, refundability &amp;
        cancellation policy.
      </p>
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────

function GroupRow({
  group,
  open,
  onExpand,
  onPatch,
}: {
  group: RateGroup;
  open: boolean;
  onExpand: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [savingVisibility, setSavingVisibility] = useState(false);
  const roomCount = group.plans.length;
  const shownName = group.displayName || group.name;

  async function toggle() {
    if (savingVisibility) return;
    setSavingVisibility(true);
    try {
      await onPatch({ isPublic: !group.isShown });
    } finally {
      setSavingVisibility(false);
    }
  }

  return (
    <div
      className="border rounded-md overflow-hidden"
      style={{
        borderColor: open ? "var(--a-accent)" : "var(--a-border)",
        background: "var(--a-surface)",
        opacity: group.isShown ? 1 : 0.6,
      }}
    >
      <div className="w-full px-3.5 py-2.5 flex items-center gap-3">
        <button
          onClick={onExpand}
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
            <div className="text-[13px] font-medium truncate">
              {shownName}
              {group.displayName && (
                <span
                  className="ml-1.5 font-normal font-jbm text-[10.5px]"
                  style={{ color: "var(--a-accent)" }}
                >
                  · custom
                </span>
              )}
            </div>
            <div
              className="font-jbm text-[11px] mt-0.5 truncate"
              style={{ color: "var(--a-muted)" }}
            >
              Cloudbeds: {group.name} · {roomCount} room{" "}
              {roomCount === 1 ? "type" : "types"}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {group.isRefundable ? (
            <Pill tone="green">refundable</Pill>
          ) : (
            <Pill tone="gray">non-refundable</Pill>
          )}
          {group.policy?.deadlineHours !== undefined && (
            <Pill tone="blue">{group.policy.deadlineHours}h deadline</Pill>
          )}
          <button
            onClick={toggle}
            disabled={savingVisibility}
            title={
              group.isShown
                ? "Shown in the booking engine — click to hide across all rooms"
                : "Hidden from the booking engine — click to show across all rooms"
            }
            className="text-[11px] px-2 py-0.5 rounded border font-medium"
            style={
              group.isShown
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
            {savingVisibility ? "…" : group.isShown ? "Shown" : "Hidden"}
          </button>
        </div>
      </div>
      {open && <Editor group={group} onPatch={onPatch} onDone={onExpand} />}
    </div>
  );
}

// ─── Editor ─────────────────────────────────────────────────────

function Editor({
  group,
  onPatch,
  onDone,
}: {
  group: RateGroup;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
  onDone: () => void;
}) {
  const [displayName, setDisplayName] = useState<string>(
    group.displayName ?? ""
  );
  const [isRefundable, setIsRefundable] = useState<boolean>(group.isRefundable);
  const [deadlineHours, setDeadlineHours] = useState<string>(
    group.policy?.deadlineHours?.toString() ?? "48"
  );
  const [penaltyType, setPenaltyType] = useState<
    NonNullable<CancellationPolicy["penaltyType"]>
  >(group.policy?.penaltyType ?? "first_night");
  const [penaltyPercent, setPenaltyPercent] = useState<string>(
    group.policy?.penaltyPercent?.toString() ?? "100"
  );
  const [note, setNote] = useState<string>(group.policy?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const policy: CancellationPolicy | null = isRefundable
        ? {
            deadlineHours: deadlineHours ? parseInt(deadlineHours, 10) : undefined,
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

      const ok = await onPatch({
        displayName: displayName.trim() || null,
        isRefundable,
        cancellationPolicy: policy,
      });
      if (!ok) throw new Error("save failed (some rooms did not update)");
      onDone();
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
      <div
        className="text-[11px] mb-3"
        style={{ color: "var(--a-muted)" }}
      >
        Applies to all {group.plans.length} room{" "}
        {group.plans.length === 1 ? "type" : "types"} offering this rate.
      </div>
      <div className="mb-3">
        <Field
          label="Booking-engine name"
          hint={`shown to guests instead of the Cloudbeds name — leave blank to use "${group.name}"`}
        >
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={group.name}
            className="w-full px-2 py-1 border rounded text-[12.5px]"
            style={{ borderColor: "var(--a-border)", background: "white" }}
          />
        </Field>
      </div>
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
        <Field label="Percent (if percent)" hint="0–100">
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
