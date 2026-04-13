"use client";

import { useState, useEffect } from "react";
import { useAdminToken } from "./layout";
import { defaultTheme } from "@/lib/theme";

interface Property {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  status: string | null;
  currency: string | null;
  createdAt: string | null;
}

export default function AdminPropertiesPage() {
  const token = useAdminToken();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [creating, setCreating] = useState(false);

  async function fetchProperties() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/properties", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProperties(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) fetchProperties();
  }, [token]);

  async function handleCreate() {
    if (!newName || !newSlug) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName,
          slug: newSlug,
          domain: newDomain || null,
          theme: defaultTheme,
        }),
      });
      if (res.ok) {
        setNewName("");
        setNewSlug("");
        setNewDomain("");
        setShowCreate(false);
        fetchProperties();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium"
        >
          + New Property
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Create Property</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (!newSlug || newSlug === slugify(newName)) {
                    setNewSlug(slugify(e.target.value));
                  }
                }}
                placeholder="The Kensington Arms"
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slug</label>
              <input
                type="text"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="kensington-arms"
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Domain (optional)
              </label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="www.thekensingtonarms.com"
                className="w-full px-3 py-2 border rounded text-sm text-gray-900"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={creating || !newName || !newSlug}
              className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : properties.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-2">No properties yet.</p>
          <p className="text-gray-400 text-sm">
            Create your first property to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Domain
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.domain ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        p.status === "live"
                          ? "bg-green-100 text-green-700"
                          : p.status === "paused"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/admin/properties/${p.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Manage
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
