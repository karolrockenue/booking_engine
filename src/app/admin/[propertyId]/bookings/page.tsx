"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { TopStrip, Btn } from "@/components/admin/TopStrip";
import { useAdminToken } from "../../layout";

interface Extra {
  id: string;
  cloudbedsItemId: string | null;
  name: string;
  qty: number;
  unitPrice: string;
  totalPrice: string;
  currency: string;
}

interface Booking {
  id: string;
  orderId: string;
  cloudbedsReservationId: string | null;
  checkIn: string;
  checkOut: string;
  adults: number | null;
  children: number | null;
  guestFirst: string;
  guestLast: string;
  guestEmail: string;
  guestPhone: string | null;
  guestCountry: string | null;
  roomTotal: string;
  extrasTotal: string;
  taxesTotal: string;
  applicationFee: string | null;
  grandTotal: string;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeSetupIntentId: string | null;
  stripeCustomerId: string | null;
  cancellationPolicySnapshot: unknown;
  rateType: string | null;
  status: string;
  createdAt: string;
  roomTypeName: string | null;
  ratePlanName: string | null;
  ratePlanIsRefundable: boolean | null;
  extras: Extra[];
}

type StatusGroup = "all" | "paid" | "card_on_file" | "failed" | "cancelled";

const STATUS_GROUPS: Record<StatusGroup, (b: Booking) => boolean> = {
  all: () => true,
  paid: (b) => b.status === "paid" || b.status === "pms_synced",
  card_on_file: (b) => b.status === "payment_authorized",
  failed: (b) => b.status === "failed",
  cancelled: (b) => b.status === "cancelled",
};

export default function BookingsPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const token = useAdminToken();

  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusGroup>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !propertyId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/properties/${propertyId}/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { bookings: Booking[] }) => setList(d.bookings))
      .catch((e) => setError(e.message ?? "failed to load"))
      .finally(() => setLoading(false));
  }, [token, propertyId]);

  const counts = useMemo(() => {
    const c = {
      all: list.length,
      paid: 0,
      card_on_file: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const b of list) {
      if (STATUS_GROUPS.paid(b)) c.paid++;
      if (STATUS_GROUPS.card_on_file(b)) c.card_on_file++;
      if (STATUS_GROUPS.failed(b)) c.failed++;
      if (STATUS_GROUPS.cancelled(b)) c.cancelled++;
    }
    return c;
  }, [list]);

  const visible = useMemo(() => {
    let result = list.filter(STATUS_GROUPS[filter]);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (b) =>
          `${b.guestFirst} ${b.guestLast}`.toLowerCase().includes(q) ||
          b.guestEmail.toLowerCase().includes(q) ||
          (b.cloudbedsReservationId ?? "").toLowerCase().includes(q) ||
          b.orderId.toLowerCase().includes(q)
      );
    }
    return result;
  }, [list, filter, search]);

  const selected = useMemo(
    () => list.find((b) => b.id === selectedId) ?? null,
    [list, selectedId]
  );

  return (
    <>
      <TopStrip
        title="Bookings"
        subtitle={
          loading
            ? "Loading…"
            : `${list.length} total · ${counts.paid} paid · ${counts.failed} failed · ${counts.cancelled} cancelled`
        }
        actions={
          <Btn onClick={() => alert("CSV export — coming in a later step")}>
            Export CSV
          </Btn>
        }
      />

      <div className="flex flex-wrap gap-1.5 items-center mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search guest, email, reservation ref…"
          className="px-2.5 py-1 border rounded text-[12.5px] w-[280px] focus:outline-none focus:border-[var(--a-accent)]"
          style={{ borderColor: "var(--a-border)" }}
        />
        <FilterBtn current={filter} value="all" onClick={setFilter} count={counts.all}>
          All
        </FilterBtn>
        <FilterBtn current={filter} value="paid" onClick={setFilter} count={counts.paid}>
          Paid
        </FilterBtn>
        <FilterBtn
          current={filter}
          value="card_on_file"
          onClick={setFilter}
          count={counts.card_on_file}
        >
          Card on file
        </FilterBtn>
        <FilterBtn current={filter} value="failed" onClick={setFilter} count={counts.failed}>
          Failed
        </FilterBtn>
        <FilterBtn
          current={filter}
          value="cancelled"
          onClick={setFilter}
          count={counts.cancelled}
        >
          Cancelled
        </FilterBtn>
      </div>

      {loading && list.length === 0 ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : error ? (
        <div className="text-[13px]" style={{ color: "var(--a-red)" }}>
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div
          className="border rounded-md p-12 text-center text-[13px]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
        >
          {list.length === 0
            ? "No bookings yet."
            : "No bookings match this filter."}
        </div>
      ) : (
        <div
          className="border rounded-md overflow-hidden"
          style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
        >
          <table className="w-full text-[12.5px]">
            <thead>
              <tr>
                <Th>Reservation</Th>
                <Th>Guest</Th>
                <Th>Check-in</Th>
                <Th align="right">Nights</Th>
                <Th>Room · rate</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
                <Th>Placed</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <Row
                  key={b.id}
                  booking={b}
                  selected={b.id === selectedId}
                  onClick={() => setSelectedId(b.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DetailPane booking={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

// ─── table primitives ────────────────────────────────────────────────

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[10.5px] uppercase tracking-wider font-medium border-b ${align === "right" ? "text-right" : "text-left"}`}
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
      className={`px-4 py-2.5 border-b ${align === "right" ? "text-right" : ""} ${mono ? "font-jbm text-[11.5px]" : ""}`}
      style={{
        borderColor: "var(--a-border-soft)",
        color: muted ? "var(--a-muted)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function Row({
  booking: b,
  selected,
  onClick,
}: {
  booking: Booking;
  selected: boolean;
  onClick: () => void;
}) {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer"
      style={{
        background: selected ? "var(--a-accent-soft)" : undefined,
      }}
    >
      <Td>
        <div className="font-jbm text-[11.5px]">
          {b.cloudbedsReservationId ?? "—"}
        </div>
        <div
          className="font-jbm text-[10.5px]"
          style={{ color: "var(--a-muted)" }}
        >
          {b.orderId.slice(0, 8)}…
        </div>
      </Td>
      <Td>
        <div>
          {b.guestFirst} {b.guestLast}
        </div>
        <div
          className="text-[11px] truncate max-w-[200px]"
          style={{ color: "var(--a-muted)" }}
        >
          {b.guestEmail}
        </div>
      </Td>
      <Td mono>{b.checkIn}</Td>
      <Td align="right" mono>
        {nights}
      </Td>
      <Td>
        <div>{b.roomTypeName ?? "—"}</div>
        <div className="text-[11px]" style={{ color: "var(--a-muted)" }}>
          {b.ratePlanName ?? (b.rateType ?? "—")}
        </div>
      </Td>
      <Td align="right" mono>
        {formatMoney(Number(b.grandTotal), b.currency)}
      </Td>
      <Td>
        <StatusPill status={b.status} />
      </Td>
      <Td muted mono>
        {timeAgo(b.createdAt)}
      </Td>
    </tr>
  );
}

// ─── detail pane ────────────────────────────────────────────────────

function DetailPane({
  booking: b,
  onClose,
}: {
  booking: Booking;
  onClose: () => void;
}) {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) /
        (24 * 60 * 60 * 1000)
    )
  );
  const stripeUrl = b.stripePaymentIntentId
    ? `https://dashboard.stripe.com/payments/${b.stripePaymentIntentId}`
    : b.stripeSetupIntentId
      ? `https://dashboard.stripe.com/setup_intents/${b.stripeSetupIntentId}`
      : null;

  return (
    <>
      {/* Backdrop on mobile only — desktop stays clickable */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-[460px] bg-white border-l overflow-y-auto z-50"
        style={{
          borderColor: "var(--a-border)",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="px-5 py-4 flex items-start gap-3 border-b"
          style={{ borderColor: "var(--a-border)" }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold">
              {b.guestFirst} {b.guestLast}
            </h2>
            <div
              className="font-jbm text-[11.5px] mt-0.5"
              style={{ color: "var(--a-muted)" }}
            >
              {b.cloudbedsReservationId ?? "—"} · order {b.orderId.slice(0, 8)}…
            </div>
          </div>
          <StatusPill status={b.status} />
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#f5f5f5] rounded"
            style={{ color: "var(--a-muted)" }}
          >
            ✕
          </button>
        </div>

        <Section title="Stay">
          <Kv k="Check-in">
            <span className="font-jbm">{b.checkIn}</span> · from 4 PM
          </Kv>
          <Kv k="Check-out">
            <span className="font-jbm">{b.checkOut}</span> · {nights} night
            {nights === 1 ? "" : "s"}
          </Kv>
          <Kv k="Room">{b.roomTypeName ?? "—"}</Kv>
          <Kv k="Rate plan">
            {b.ratePlanName ?? "—"}{" "}
            <span style={{ color: "var(--a-muted)" }}>
              ·{" "}
              {b.ratePlanIsRefundable === false
                ? "non-refundable"
                : "refundable"}
            </span>
          </Kv>
          <Kv k="Guests">
            {b.adults ?? 1} adult{(b.adults ?? 1) === 1 ? "" : "s"}
            {(b.children ?? 0) > 0 &&
              ` · ${b.children} child${b.children === 1 ? "" : "ren"}`}
          </Kv>
        </Section>

        <Section title="Guest">
          <Kv k="Name">
            {b.guestFirst} {b.guestLast}
          </Kv>
          <Kv k="Email">{b.guestEmail}</Kv>
          <Kv k="Phone">
            {b.guestPhone || (
              <span style={{ color: "var(--a-muted)" }}>—</span>
            )}
          </Kv>
          <Kv k="Country">
            {b.guestCountry || (
              <span style={{ color: "var(--a-muted)" }}>—</span>
            )}
          </Kv>
        </Section>

        <Section title="Folio">
          <Kv k={`Room (${nights} × ${formatMoney(Number(b.roomTotal) / nights, b.currency)})`}>
            <span className="font-jbm">{formatMoney(Number(b.roomTotal), b.currency)}</span>
          </Kv>
          {b.extras.length > 0 ? (
            b.extras.map((e) => (
              <Kv key={e.id} k={`${e.name} (× ${e.qty})`}>
                <span className="font-jbm">
                  {formatMoney(Number(e.totalPrice), e.currency)}
                </span>
              </Kv>
            ))
          ) : Number(b.extrasTotal) > 0 ? (
            <Kv k="Extras">
              <span className="font-jbm">{formatMoney(Number(b.extrasTotal), b.currency)}</span>
            </Kv>
          ) : null}
          {Number(b.taxesTotal) > 0 && (
            <Kv k="Taxes & fees">
              <span className="font-jbm">{formatMoney(Number(b.taxesTotal), b.currency)}</span>
            </Kv>
          )}
          <Kv k="Total">
            <span className="font-jbm font-semibold">
              {formatMoney(Number(b.grandTotal), b.currency)}
            </span>
          </Kv>
        </Section>

        <Section title="Payment">
          <Kv k="Rate type">
            {b.rateType === "nr"
              ? "Non-refundable (paid)"
              : b.rateType === "flex"
                ? "Flex (card on file)"
                : "—"}
          </Kv>
          {b.stripePaymentIntentId && (
            <Kv k="Stripe PI">
              <span className="font-jbm">
                {b.stripePaymentIntentId.slice(0, 12)}…
              </span>
            </Kv>
          )}
          {b.stripeSetupIntentId && (
            <Kv k="Stripe SI">
              <span className="font-jbm">
                {b.stripeSetupIntentId.slice(0, 12)}…
              </span>
            </Kv>
          )}
          {b.applicationFee && (
            <Kv k="Application fee">
              <span className="font-jbm">
                {formatMoney(Number(b.applicationFee), b.currency)}
              </span>
            </Kv>
          )}
          <Kv k="Cloudbeds folio">
            {b.status === "pms_synced" || b.cloudbedsReservationId ? (
              <Pill tone="green">synced</Pill>
            ) : (
              <Pill tone="amber">not synced</Pill>
            )}
          </Kv>
        </Section>

        <div
          className="px-5 py-4 flex flex-wrap gap-1.5 border-t"
          style={{ borderColor: "var(--a-border)" }}
        >
          <Btn
            size="sm"
            onClick={() =>
              alert("Resend confirmation — coming in a later step")
            }
          >
            Resend confirmation
          </Btn>
          {stripeUrl && (
            <Btn size="sm" href={stripeUrl} newTab>
              View on Stripe ↗
            </Btn>
          )}
          <Btn
            size="sm"
            variant="danger"
            onClick={() =>
              alert("Cancel · refund — coming in a later step")
            }
          >
            Cancel · refund
          </Btn>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: "var(--a-border-soft)" }}>
      <h3
        className="px-5 pt-4 pb-1.5 text-[11px] font-medium uppercase tracking-wider"
        style={{ color: "var(--a-muted)" }}
      >
        {title}
      </h3>
      <div className="pb-2">{children}</div>
    </div>
  );
}

function Kv({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-5 py-1.5 text-[12.5px]">
      <div className="w-[160px] flex-shrink-0" style={{ color: "var(--a-muted)" }}>
        {k}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── shared ────────────────────────────────────────────────────────

function FilterBtn({
  current,
  value,
  onClick,
  count,
  children,
}: {
  current: StatusGroup;
  value: StatusGroup;
  onClick: (v: StatusGroup) => void;
  count: number;
  children: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className="px-2.5 py-1 rounded text-[11.5px] font-medium border inline-flex items-center gap-1.5"
      style={{
        borderColor: active ? "var(--a-ink)" : "var(--a-border)",
        background: active ? "var(--a-ink)" : "var(--a-surface)",
        color: active ? "#fff" : "var(--a-ink)",
      }}
    >
      {children}
      <span
        className="font-jbm text-[10.5px]"
        style={{ color: active ? "rgba(255,255,255,0.7)" : "var(--a-muted)" }}
      >
        {count}
      </span>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: "green" | "blue" | "amber" | "red" | "gray"; label: string }> = {
    paid: { tone: "green", label: "paid" },
    pms_synced: { tone: "green", label: "synced" },
    payment_authorized: { tone: "blue", label: "card on file" },
    pending: { tone: "amber", label: "pending" },
    failed: { tone: "red", label: "failed" },
    cancelled: { tone: "gray", label: "cancelled" },
  };
  const cfg = map[status] ?? { tone: "gray" as const, label: status };
  return <Pill tone={cfg.tone}>{cfg.label}</Pill>;
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
  const useDecimals = amount > 0 && amount < 10000;
  const formatted = useDecimals
    ? amount.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : Math.round(amount).toLocaleString("en-GB");
  return `${symbol}${formatted}`;
}

function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d2 = Math.round(h / 24);
  return `${d2}d ago`;
}
