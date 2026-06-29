"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { useAdminAuth } from "../layout";

interface PropertyMeta {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  currency: string | null;
  status: string | null;
}

const TAB_FROM_PATH: Record<string, Parameters<typeof Sidebar>[0]["activeTab"]> = {
  bookings: "bookings",
  content: "content",
  media: "media",
  rooms: "rooms",
  rates: "rates",
  extras: "extras",
  emails: "emails",
  alerts: "alerts",
  design: "design",
  legal: "legal",
  analytics: "analytics",
  cloudbeds: "cloudbeds",
  mews: "mews",
  domain: "domain",
};

export default function PropertyLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ propertyId: string }>();
  const propertyId = params.propertyId;
  const pathname = usePathname();
  const router = useRouter();
  const { token, logout } = useAdminAuth();
  const [property, setProperty] = useState<PropertyMeta | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token || !propertyId) return;
    setNotFound(false);
    fetch(`/api/admin/properties/${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((p) => {
        if (p) {
          setProperty({
            id: p.id,
            slug: p.slug,
            name: p.name,
            domain: p.domain,
            currency: p.currency,
            status: p.status,
          });
        }
      });
  }, [token, propertyId]);

  if (notFound) {
    return (
      <div className="p-8">
        <p className="text-[14px]" style={{ color: "var(--a-muted)" }}>
          Property not found.{" "}
          <button onClick={() => router.push("/admin")} className="underline">
            Back to dashboard
          </button>
        </p>
      </div>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const tabSlug = segments[2];
  const activeTab = tabSlug ? TAB_FROM_PATH[tabSlug] ?? "overview" : "overview";

  // Path-based routing: a hotel lives at /<slug> (the ?property= shim is
  // retired — it fell through to the domain owner, opening the wrong hotel).
  // A property with its own domain opens that; everything else (incl. a
  // freshly-installed cert hotel with no domain yet) opens its slug path.
  const siteUrl = property?.domain
    ? `https://${property.domain}`
    : property?.slug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/${property.slug}`
      : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        propertyId={propertyId}
        propertyName={property?.name ?? "Loading…"}
        propertySlug={property?.slug ?? null}
        propertyCurrency={property?.currency ?? null}
        activeTab={activeTab}
        userEmail="karol@rockenue.com"
        onLogout={logout}
      />
      <main className="flex-1 px-8 py-6 max-w-[1560px]">
        <PropertyBar
          name={property?.name ?? null}
          domain={property?.domain ?? null}
          currency={property?.currency ?? null}
          status={property?.status ?? null}
          siteUrl={siteUrl}
        />
        {children}
      </main>
    </div>
  );
}

function PropertyBar({
  name,
  domain,
  currency,
  status,
  siteUrl,
}: {
  name: string | null;
  domain: string | null;
  currency: string | null;
  status: string | null;
  siteUrl: string | null;
}) {
  return (
    <div
      className="flex items-center gap-3 mb-6 pb-3 border-b text-[12px]"
      style={{ borderColor: "var(--a-border-soft)" }}
    >
      <span className="font-medium" style={{ color: "var(--a-ink)" }}>
        {name ?? "—"}
      </span>
      {status && <StatusDot status={status} />}
      {domain && (
        <span className="font-jbm" style={{ color: "var(--a-muted)" }}>
          {domain}
        </span>
      )}
      {currency && (
        <span className="font-jbm" style={{ color: "var(--a-muted)" }}>
          · {currency}
        </span>
      )}
      <div className="ml-auto flex gap-1.5">
        {siteUrl && (
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded text-[11.5px] font-medium border inline-flex items-center gap-1"
            style={{
              borderColor: "var(--a-border)",
              background: "var(--a-surface)",
              color: "var(--a-ink)",
            }}
          >
            Open site ↗
          </a>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "live"
      ? { color: "var(--a-green)", bg: "var(--a-green-soft)", border: "rgba(0,135,90,0.25)" }
      : status === "paused"
        ? { color: "var(--a-amber)", bg: "var(--a-amber-soft)", border: "rgba(180,83,9,0.25)" }
        : { color: "var(--a-accent)", bg: "var(--a-accent-soft)", border: "rgba(91,91,214,0.25)" };
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium border font-jbm"
      style={{ color: tone.color, background: tone.bg, borderColor: tone.border }}
    >
      <span className="w-1 h-1 rounded-full" style={{ background: "currentColor" }} />
      {status}
    </span>
  );
}
