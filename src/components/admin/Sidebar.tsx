"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/rockenue/Wordmark";

interface SidebarProps {
  propertyId: string;
  propertyName: string;
  propertySlug?: string | null;
  propertyCurrency?: string | null;
  activeTab:
    | "overview"
    | "bookings"
    | "content"
    | "media"
    | "rooms"
    | "rates"
    | "extras"
    | "emails"
    | "alerts"
    | "design"
    | "legal"
    | "analytics"
    | "cloudbeds"
    | "mews"
    | "stripe"
    | "domain";
  bookingsCount?: number;
  photosCount?: number;
  ratesCount?: number;
  emailsCount?: number;
  alertsCount?: number;
  userEmail?: string;
  onLogout?: () => void;
}

type PropertyItemId = "overview" | "bookings" | "content" | "media" | "rooms" | "rates" | "extras" | "emails" | "alerts" | "design" | "legal" | "analytics";

const PROPERTY_ITEMS: Array<{
  id: PropertyItemId;
  icon: string;
  label: string;
  countKey?: "bookingsCount" | "photosCount" | "ratesCount" | "emailsCount" | "alertsCount";
}> = [
  { id: "overview", icon: "◉", label: "Overview" },
  { id: "bookings", icon: "▤", label: "Bookings", countKey: "bookingsCount" },
  { id: "content", icon: "¶", label: "Content" },
  { id: "media", icon: "▣", label: "Media", countKey: "photosCount" },
  { id: "rooms", icon: "⌂", label: "Rooms" },
  { id: "rates", icon: "≡", label: "Rate plans", countKey: "ratesCount" },
  { id: "extras", icon: "✦", label: "Extras" },
  { id: "emails", icon: "✉", label: "Emails", countKey: "emailsCount" },
  { id: "alerts", icon: "⇄", label: "Alerts", countKey: "alertsCount" },
  { id: "design", icon: "◇", label: "Design" },
  { id: "legal", icon: "§", label: "Legal" },
  { id: "analytics", icon: "▲", label: "Analytics" },
];

const INTEGRATION_ITEMS = [
  { id: "cloudbeds", icon: "●", label: "Cloudbeds" },
  { id: "mews", icon: "◆", label: "Mews" },
  { id: "stripe", icon: "$", label: "Stripe" },
  { id: "ryft", icon: "◈", label: "Ryft" },
  { id: "domain", icon: "⌘", label: "Domain & deploy" },
] as const;

export function Sidebar({
  propertyId,
  propertyName,
  propertySlug,
  propertyCurrency,
  activeTab,
  bookingsCount,
  photosCount,
  ratesCount,
  emailsCount,
  alertsCount,
  userEmail,
  onLogout,
}: SidebarProps) {
  const router = useRouter();
  const counts: Record<string, number | undefined> = {
    bookingsCount,
    photosCount,
    ratesCount,
    emailsCount,
    alertsCount,
  };
  const meta = [propertySlug, propertyCurrency].filter(Boolean).join(" · ");

  return (
    <aside className="border-r flex flex-col sticky top-0 h-screen overflow-y-auto p-3"
      style={{ background: "var(--a-side)", borderColor: "var(--a-border)", width: 240 }}
    >
      <div className="px-1.5 pt-1 pb-3">
        <Wordmark variant="light" size="sm" />
      </div>
      <button
        onClick={() => router.push("/admin")}
        title="Switch hotel — back to dashboard"
        className="block w-full text-left px-2.5 py-2 rounded-md border bg-white hover:bg-[#fafafa] mb-4"
        style={{ borderColor: "var(--a-border)" }}
      >
        <div className="flex items-center mb-0.5">
          <span
            className="text-[9.5px] uppercase tracking-wider font-medium font-jbm"
            style={{ color: "var(--a-muted)" }}
          >
            Hotel
          </span>
          <span className="ml-auto text-[11px]" style={{ color: "var(--a-muted)" }}>⇅</span>
        </div>
        <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--a-ink)" }}>
          {propertyName}
        </div>
        {meta && (
          <div className="text-[10.5px] font-jbm truncate" style={{ color: "var(--a-muted)" }}>
            {meta}
          </div>
        )}
      </button>

      <NavGroup label="Property">
        {PROPERTY_ITEMS.map((it) => {
          const count = it.countKey ? counts[it.countKey] : undefined;
          const isAlert = it.id === "alerts" && (count ?? 0) > 0;
          return (
            <NavItem
              key={it.id}
              href={`/admin/${propertyId}${it.id === "overview" ? "" : `/${it.id}`}`}
              icon={it.icon}
              label={it.label}
              count={count}
              alertStyle={isAlert}
              active={activeTab === it.id}
            />
          );
        })}
      </NavGroup>

      <NavGroup label="Integrations">
        {INTEGRATION_ITEMS.map((it) => (
          <NavItem
            key={it.id}
            href={`/admin/${propertyId}/${it.id}`}
            icon={it.icon}
            label={it.label}
            active={activeTab === it.id}
          />
        ))}
      </NavGroup>

      <div className="mt-auto pt-3 border-t" style={{ borderColor: "var(--a-border)" }}>
        {userEmail && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-[12.5px]" style={{ color: "var(--a-muted)" }}>
            <span className="w-[22px] h-[22px] rounded-full bg-[#e5e5e5]" aria-hidden />
            <span className="flex-1 truncate">{userEmail}</span>
            {onLogout && (
              <button onClick={onLogout} className="text-[11px] hover:text-[var(--a-ink)]">
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div
        className="px-2 py-1 text-[10.5px] font-medium uppercase tracking-wider"
        style={{ color: "var(--a-muted)" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  count,
  alertStyle,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  count?: number;
  alertStyle?: boolean;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors"
      style={{
        color: active ? "var(--a-accent)" : "var(--a-ink-2)",
        background: active ? "var(--a-accent-soft)" : "transparent",
        fontWeight: active ? 500 : 400,
      }}
    >
      <span className="w-3.5 text-center" style={{ opacity: active ? 1 : 0.7 }}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span
          className="text-[11px] font-jbm"
          style={{ color: alertStyle ? "var(--a-red)" : "var(--a-muted)" }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
