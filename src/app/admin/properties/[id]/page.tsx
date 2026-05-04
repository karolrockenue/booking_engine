"use client";

import { useState, useEffect, use } from "react";
import { useAdminToken } from "../../layout";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import type { PropertyTheme } from "@/lib/theme";

interface CancellationPolicy {
  deadlineHours?: number;
  penaltyType?: "first_night" | "full_stay" | "percent" | "none";
  penaltyPercent?: number;
  note?: string;
}

interface Property {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  cloudbedsPropertyId: string | null;
  cloudbedsConnected: boolean;
  cloudbedsTokenExpiresAt: string | null;
  stripeAccountId: string | null;
  stripeAccountStatus: string | null;
  stripeAccountCurrency: string | null;
  platformFeePercent: string | null;
  payoutSchedule: string | null;
  currency: string | null;
  timezone: string | null;
  theme: Record<string, unknown>;
  status: string | null;
  pages: Array<{ id: string; slug: string; title: string | null }>;
  roomTypes: Array<{
    id: string;
    otaRoomId: string;
    name: string;
    description: string | null;
    maxOccupancy: number | null;
    amenities: unknown;
    sortOrder: number | null;
  }>;
  ratePlans: Array<{
    id: string;
    otaRateId: string;
    name: string;
    namePublic: string | null;
    isPublic: boolean | null;
    isRefundable: boolean | null;
    roomTypeId: string | null;
    cancellationPolicy: CancellationPolicy | null;
  }>;
}

export default function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const token = useAdminToken();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"general" | "rooms" | "theme">("general");

  // Editable fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState("draft");
  const [currency, setCurrency] = useState("GBP");
  const [cloudbedsPropertyId, setCloudbedsPropertyId] = useState("");
  const [platformFeePercent, setPlatformFeePercent] = useState("3.00");
  const [payoutSchedule, setPayoutSchedule] = useState("weekly");

  // Room creation
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomOtaId, setNewRoomOtaId] = useState("");
  const [newRoomMaxOcc, setNewRoomMaxOcc] = useState("2");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Cloudbeds OAuth
  const [connecting, setConnecting] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  async function handleConnectCloudbeds() {
    setConnecting(true);
    try {
      const res = await fetch("/api/cloudbeds/oauth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorizeUrl) {
        alert(data.error ?? "Failed to start Cloudbeds OAuth");
        setConnecting(false);
        return;
      }
      window.location.href = data.authorizeUrl;
    } catch (e) {
      alert("Failed to start Cloudbeds OAuth");
      setConnecting(false);
    }
  }

  async function handleConnectStripe() {
    setConnectingStripe(true);
    try {
      const res = await fetch("/api/stripe/connect/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.onboardingUrl) {
        alert(data.error ?? "Failed to start Stripe onboarding");
        setConnectingStripe(false);
        return;
      }
      window.location.href = data.onboardingUrl;
    } catch {
      alert("Failed to start Stripe onboarding");
      setConnectingStripe(false);
    }
  }

  async function fetchProperty() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProperty(data);
        setName(data.name);
        setSlug(data.slug);
        setDomain(data.domain ?? "");
        setStatus(data.status ?? "draft");
        setCurrency(data.currency ?? "GBP");
        setCloudbedsPropertyId(data.cloudbedsPropertyId ?? "");
        setPlatformFeePercent(data.platformFeePercent ?? "3.00");
        setPayoutSchedule(data.payoutSchedule ?? "weekly");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchProperty();
  }, [token, id]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/admin/properties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          slug,
          domain: domain || null,
          status,
          currency,
          cloudbedsPropertyId: cloudbedsPropertyId || null,
          platformFeePercent,
          payoutSchedule,
        }),
      });
      fetchProperty();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRoom() {
    if (!newRoomName || !newRoomOtaId) return;
    setCreatingRoom(true);
    try {
      await fetch(`/api/admin/properties/${id}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newRoomName,
          otaRoomId: newRoomOtaId,
          maxOccupancy: parseInt(newRoomMaxOcc) || 2,
          description: newRoomDesc || null,
        }),
      });
      setNewRoomName("");
      setNewRoomOtaId("");
      setNewRoomMaxOcc("2");
      setNewRoomDesc("");
      fetchProperty();
    } finally {
      setCreatingRoom(false);
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading...</p>;
  }

  if (!property) {
    return <p className="text-red-600 text-sm">Property not found.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
          &larr; Properties
        </a>
        <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
        <span
          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
            status === "live"
              ? "bg-green-100 text-green-700"
              : status === "paused"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          {status}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(["general", "rooms", "theme"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* General tab */}
      {tab === "general" && (
        <div className="bg-white border rounded-lg p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="www.thehotel.com"
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              >
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              >
                <option value="draft">Draft</option>
                <option value="live">Live</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Cloudbeds Property ID
              </label>
              <input
                type="text"
                value={cloudbedsPropertyId}
                onChange={(e) => setCloudbedsPropertyId(e.target.value)}
                placeholder="From Cloudbeds"
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Platform fee %
              </label>
              <input
                type="text"
                value={platformFeePercent}
                onChange={(e) => setPlatformFeePercent(e.target.value)}
                placeholder="3.00"
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Payout schedule
              </label>
              <select
                value={payoutSchedule}
                onChange={(e) => setPayoutSchedule(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {/* Connection status. Cloudbeds tokens set by OAuth (Step 4); Stripe
              status set by Connect onboarding (Step 9). */}
          <div className="mt-6 grid gap-4 md:grid-cols-2 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-500">Cloudbeds:</span>
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  property.cloudbedsConnected
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {property.cloudbedsConnected ? "connected" : "not connected"}
              </span>
              <button
                type="button"
                onClick={handleConnectCloudbeds}
                disabled={connecting}
                className="text-xs px-2 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {connecting
                  ? "Redirecting..."
                  : property.cloudbedsConnected
                    ? "Reconnect"
                    : "Connect to Cloudbeds"}
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-500">Stripe:</span>
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  property.stripeAccountStatus === "active"
                    ? "bg-green-100 text-green-700"
                    : property.stripeAccountStatus === "restricted"
                      ? "bg-red-100 text-red-700"
                      : property.stripeAccountId
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-500"
                }`}
              >
                {property.stripeAccountId
                  ? (property.stripeAccountStatus ?? "pending")
                  : "not connected"}
              </span>
              {property.stripeAccountCurrency && (
                <span className="text-gray-400">
                  · {property.stripeAccountCurrency.toUpperCase()}
                </span>
              )}
              {property.stripeAccountCurrency &&
                property.currency &&
                property.stripeAccountCurrency.toLowerCase() !==
                  property.currency.toLowerCase() && (
                  <span className="text-red-600 text-xs">
                    ⚠ currency mismatch ({property.currency})
                  </span>
                )}
              <button
                type="button"
                onClick={handleConnectStripe}
                disabled={connectingStripe}
                className="text-xs px-2 py-0.5 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {connectingStripe
                  ? "Redirecting..."
                  : property.stripeAccountStatus === "active"
                    ? "Manage in Stripe"
                    : property.stripeAccountId
                      ? "Resume onboarding"
                      : "Connect to Stripe"}
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 px-6 py-2 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Rooms tab */}
      {tab === "rooms" && (
        <div>
          {/* Existing rooms */}
          {property.roomTypes.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">OTA Room ID</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Max Occ.</th>
                  </tr>
                </thead>
                <tbody>
                  {property.roomTypes.map((room) => (
                    <tr key={room.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-gray-900">{room.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{room.otaRoomId}</td>
                      <td className="px-4 py-3 text-gray-600">{room.maxOccupancy ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rate plans + cancellation policy editor */}
          {property.ratePlans.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden mb-6">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="text-sm font-medium text-gray-600">
                  Rate Plans &amp; Cancellation Policies
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Snapshotted to each booking at checkout. Edits affect new bookings only.
                </p>
              </div>
              <div className="divide-y">
                {property.ratePlans.map((rp) => (
                  <RatePlanPolicyRow
                    key={rp.id}
                    propertyId={id}
                    ratePlan={rp}
                    token={token}
                    onSaved={fetchProperty}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add room */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Add Room Type</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Room Name</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Deluxe Double"
                  className="w-full px-3 py-2 border rounded text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  OTA Room ID (for Cloudbeds mapping)
                </label>
                <input
                  type="text"
                  value={newRoomOtaId}
                  onChange={(e) => setNewRoomOtaId(e.target.value)}
                  placeholder="deluxe-double"
                  className="w-full px-3 py-2 border rounded text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Occupancy</label>
                <input
                  type="number"
                  value={newRoomMaxOcc}
                  onChange={(e) => setNewRoomMaxOcc(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <input
                  type="text"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border rounded text-sm text-gray-900"
                />
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={creatingRoom || !newRoomName || !newRoomOtaId}
              className="mt-4 px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {creatingRoom ? "Adding..." : "Add Room"}
            </button>
          </div>
        </div>
      )}

      {/* Theme tab */}
      {tab === "theme" && (
        <div className="bg-white border rounded-lg p-6">
          <ThemeEditor
            theme={property.theme as unknown as PropertyTheme}
            onSave={async (updatedTheme) => {
              await fetch(`/api/admin/properties/${id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ theme: updatedTheme }),
              });
              fetchProperty();
            }}
          />
        </div>
      )}
    </div>
  );
}

function RatePlanPolicyRow({
  propertyId,
  ratePlan,
  token,
  onSaved,
}: {
  propertyId: string;
  ratePlan: {
    id: string;
    name: string;
    namePublic: string | null;
    otaRateId: string;
    isRefundable: boolean | null;
    cancellationPolicy: CancellationPolicy | null;
  };
  token: string;
  onSaved: () => void;
}) {
  const initialPolicy = ratePlan.cancellationPolicy ?? {};
  const [isRefundable, setIsRefundable] = useState(
    ratePlan.isRefundable !== false
  );
  const [deadlineHours, setDeadlineHours] = useState<string>(
    initialPolicy.deadlineHours !== undefined
      ? String(initialPolicy.deadlineHours)
      : "72"
  );
  const [penaltyType, setPenaltyType] = useState<
    NonNullable<CancellationPolicy["penaltyType"]>
  >(initialPolicy.penaltyType ?? "first_night");
  const [penaltyPercent, setPenaltyPercent] = useState<string>(
    initialPolicy.penaltyPercent !== undefined
      ? String(initialPolicy.penaltyPercent)
      : "50"
  );
  const [saving, setSaving] = useState(false);

  const dirty =
    isRefundable !== (ratePlan.isRefundable !== false) ||
    String(initialPolicy.deadlineHours ?? "") !== deadlineHours ||
    (initialPolicy.penaltyType ?? "first_night") !== penaltyType ||
    String(initialPolicy.penaltyPercent ?? "") !== penaltyPercent;

  async function handleSave() {
    setSaving(true);
    try {
      const policy: CancellationPolicy | null = isRefundable
        ? {
            deadlineHours: Number(deadlineHours) || 0,
            penaltyType,
            ...(penaltyType === "percent"
              ? { penaltyPercent: Number(penaltyPercent) || 0 }
              : {}),
          }
        : null;

      await fetch(
        `/api/admin/properties/${propertyId}/rate-plans/${ratePlan.id}`,
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
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
      <div>
        <div className="text-sm font-medium text-gray-900">
          {ratePlan.namePublic ?? ratePlan.name}
        </div>
        <div className="text-xs text-gray-500 font-mono">
          {ratePlan.otaRateId}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 items-center text-xs">
          <label className="flex items-center gap-1.5 text-gray-700">
            <input
              type="checkbox"
              checked={isRefundable}
              onChange={(e) => setIsRefundable(e.target.checked)}
            />
            Refundable
          </label>
          {isRefundable && (
            <>
              <label className="flex items-center gap-1.5 text-gray-700">
                Deadline (hours before check-in)
                <input
                  type="number"
                  value={deadlineHours}
                  onChange={(e) => setDeadlineHours(e.target.value)}
                  className="w-16 px-2 py-0.5 border rounded text-gray-900"
                />
              </label>
              <label className="flex items-center gap-1.5 text-gray-700">
                Penalty
                <select
                  value={penaltyType}
                  onChange={(e) =>
                    setPenaltyType(
                      e.target.value as NonNullable<
                        CancellationPolicy["penaltyType"]
                      >
                    )
                  }
                  className="px-2 py-0.5 border rounded text-gray-900"
                >
                  <option value="none">None</option>
                  <option value="first_night">First night</option>
                  <option value="percent">Percent</option>
                  <option value="full_stay">Full stay</option>
                </select>
              </label>
              {penaltyType === "percent" && (
                <label className="flex items-center gap-1.5 text-gray-700">
                  %
                  <input
                    type="number"
                    value={penaltyPercent}
                    onChange={(e) => setPenaltyPercent(e.target.value)}
                    className="w-14 px-2 py-0.5 border rounded text-gray-900"
                  />
                </label>
              )}
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!dirty || saving}
        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:opacity-30 self-center"
      >
        {saving ? "Saving..." : dirty ? "Save" : "Saved"}
      </button>
    </div>
  );
}
