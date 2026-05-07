"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAdminAuth } from "./layout";
import { Btn } from "@/components/admin/TopStrip";

interface Property {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  status: string | null;
  currency: string | null;
  cloudbedsConnected: boolean;
  cloudbedsPropertyId: string | null;
  stripeAccountId: string | null;
  stripeAccountStatus: string | null;
  bookings7d: number;
  revenue7d: number;
}

type Filter = "all" | "live" | "needs-attention" | "setup";

export default function AdminDashboardPage() {
  const { token, logout } = useAdminAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/properties", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProperties)
      .finally(() => setLoading(false));
  }, [token]);

  const counts = useMemo(() => {
    const live = properties.filter((p) => isLive(p)).length;
    const setup = properties.filter((p) => !isLive(p)).length;
    const attention = properties.filter((p) => needsAttention(p)).length;
    return { all: properties.length, live, setup, attention };
  }, [properties]);

  const visible = useMemo(() => {
    let list = properties;
    if (filter === "live") list = list.filter(isLive);
    else if (filter === "setup") list = list.filter((p) => !isLive(p));
    else if (filter === "needs-attention") list = list.filter(needsAttention);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.domain ?? "").toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q)
      );
    }
    return list;
  }, [properties, filter, search]);

  return (
    <div className="max-w-[1380px] mx-auto px-8 py-8">
      <div className="flex items-start gap-4 mb-6">
        <div>
          <div
            className="text-[11px] uppercase tracking-wider mb-1"
            style={{ color: "var(--a-muted)" }}
          >
            Booking engine admin
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight">Hotels</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--a-muted)" }}>
            {counts.all} {counts.all === 1 ? "property" : "properties"} · {counts.live} live ·{" "}
            {counts.setup} in setup{counts.attention > 0 && ` · ${counts.attention} need attention`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] font-jbm" style={{ color: "var(--a-muted)" }}>
            karol@rockenue.com
          </span>
          <Btn variant="ghost" size="sm" onClick={logout}>
            Logout
          </Btn>
          <Btn variant="primary" onClick={() => alert("New hotel onboarding — coming in a later step")}>
            + New hotel
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, domain, slug…"
          className="px-2.5 py-1 border rounded text-[12.5px] w-[280px] focus:outline-none focus:border-[var(--a-accent)]"
          style={{ borderColor: "var(--a-border)" }}
        />
        <FilterBtn current={filter} value="all" onClick={setFilter} count={counts.all}>
          All
        </FilterBtn>
        <FilterBtn current={filter} value="live" onClick={setFilter} count={counts.live}>
          Live
        </FilterBtn>
        <FilterBtn
          current={filter}
          value="needs-attention"
          onClick={setFilter}
          count={counts.attention}
        >
          Needs attention
        </FilterBtn>
        <FilterBtn current={filter} value="setup" onClick={setFilter} count={counts.setup}>
          In setup
        </FilterBtn>
      </div>

      {loading ? (
        <div className="text-[13px]" style={{ color: "var(--a-muted)" }}>
          Loading…
        </div>
      ) : visible.length === 0 ? (
        <div
          className="bg-white border rounded-md p-12 text-center"
          style={{ borderColor: "var(--a-border)" }}
        >
          <p className="text-[13px]" style={{ color: "var(--a-muted)" }}>
            {properties.length === 0
              ? "No properties yet."
              : "No hotels match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((p) => (
            <PropertyTile key={p.id} property={p} />
          ))}
        </div>
      )}

      <p className="mt-6 text-[11.5px]" style={{ color: "var(--a-muted)" }}>
        Bookings &amp; revenue: last 7 days, excludes failed and cancelled. Launch checklist + alert badge land when their tabs are built.
      </p>
    </div>
  );
}

// ─────── tile ───────

function PropertyTile({ property: p }: { property: Property }) {
  const pills = derivePills(p);
  return (
    <Link
      href={`/admin/${p.id}`}
      className="block bg-white border rounded-md p-4 hover:border-[#c0c0c0] transition-colors"
      style={{ borderColor: "var(--a-border)" }}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13.5px] tracking-tight truncate">{p.name}</div>
          <div
            className="font-jbm text-[11.5px] mt-0.5 truncate"
            style={{ color: "var(--a-muted)" }}
          >
            {p.domain ?? p.slug}
          </div>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap mb-2.5">
        {pills.map((pill, i) => (
          <Pill key={i} tone={pill.tone}>
            {pill.text}
          </Pill>
        ))}
      </div>
      <div
        className="flex gap-3.5 pt-2.5 text-[11.5px] border-t"
        style={{ color: "var(--a-muted)", borderColor: "var(--a-border-soft)" }}
      >
        <span>
          <span className="font-jbm font-semibold" style={{ color: "var(--a-ink)" }}>
            {p.bookings7d}
          </span>{" "}
          bookings · 7d
        </span>
        <span>
          <span className="font-jbm font-semibold" style={{ color: "var(--a-ink)" }}>
            {formatRevenue(p.revenue7d, p.currency)}
          </span>{" "}
          revenue · 7d
        </span>
      </div>
    </Link>
  );
}

// ─────── derive ───────

type PillTone = "green" | "amber" | "red" | "blue" | "gray";

function derivePills(p: Property): Array<{ tone: PillTone; text: string }> {
  const pills: Array<{ tone: PillTone; text: string }> = [];

  // Live status
  if (p.status === "live") pills.push({ tone: "green", text: "live" });
  else if (p.status === "paused") pills.push({ tone: "amber", text: "paused" });
  else pills.push({ tone: "blue", text: "draft" });

  // Cloudbeds
  if (p.cloudbedsConnected) pills.push({ tone: "green", text: "cloudbeds" });
  else pills.push({ tone: "gray", text: "cloudbeds —" });

  // Stripe
  if (p.stripeAccountStatus === "active") pills.push({ tone: "green", text: "stripe" });
  else if (p.stripeAccountStatus === "restricted")
    pills.push({ tone: "amber", text: "stripe restricted" });
  else if (p.stripeAccountStatus === "pending" && p.stripeAccountId)
    pills.push({ tone: "amber", text: "stripe pending" });
  else pills.push({ tone: "gray", text: "stripe —" });

  return pills;
}

function isLive(p: Property): boolean {
  return p.status === "live";
}

function needsAttention(p: Property): boolean {
  // Live property whose Stripe is restricted, or any property where cloudbeds is meant to be connected
  // but token presence is missing while a property ID is set (re-auth required).
  if (p.stripeAccountStatus === "restricted") return true;
  if (p.cloudbedsPropertyId && !p.cloudbedsConnected) return true;
  return false;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
  AED: "AED ",
  PLN: "zł ",
};

function formatRevenue(amount: number, currency: string | null): string {
  if (!amount) return "—";
  const symbol = CURRENCY_SYMBOLS[currency ?? "GBP"] ?? `${currency ?? ""} `;
  // Round to nearest unit; tiles don't need pennies.
  const rounded = Math.round(amount);
  return `${symbol}${rounded.toLocaleString("en-GB")}`;
}

// ─────── pills ───────

function Pill({ children, tone }: { children: React.ReactNode; tone: PillTone }) {
  const tones: Record<PillTone, { color: string; bg: string; border: string }> = {
    green: { color: "var(--a-green)", bg: "var(--a-green-soft)", border: "rgba(0,135,90,0.25)" },
    amber: { color: "var(--a-amber)", bg: "var(--a-amber-soft)", border: "rgba(180,83,9,0.25)" },
    red:   { color: "var(--a-red)",   bg: "var(--a-red-soft)",   border: "rgba(198,40,40,0.25)" },
    blue:  { color: "var(--a-accent)",bg: "var(--a-accent-soft)",border: "rgba(91,91,214,0.25)" },
    gray:  { color: "var(--a-muted)", bg: "#f5f5f5",             border: "var(--a-border)" },
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

// ─────── filter button ───────

function FilterBtn({
  current,
  value,
  onClick,
  count,
  children,
}: {
  current: Filter;
  value: Filter;
  onClick: (v: Filter) => void;
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
