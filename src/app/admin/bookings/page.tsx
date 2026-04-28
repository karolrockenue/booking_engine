"use client";

import { useState, useEffect } from "react";
import { useAdminToken } from "../layout";

interface Booking {
  id: string;
  orderId: string;
  propertyName: string | null;
  checkIn: string;
  checkOut: string;
  guestFirst: string;
  guestLast: string;
  guestEmail: string;
  grandTotal: string;
  currency: string;
  status: string | null;
  createdAt: string | null;
}

export default function AdminBookingsPage() {
  const token = useAdminToken();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [token]);

  const symbol = (c: string) => (c === "GBP" ? "\u00A3" : c === "EUR" ? "\u20AC" : "$");

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h1>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <p className="text-gray-500">No bookings yet.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Order ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Property</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Guest</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Dates</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">{b.orderId}</td>
                  <td className="px-4 py-3 text-gray-600">{b.propertyName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">
                      {b.guestFirst} {b.guestLast}
                    </div>
                    <div className="text-xs text-gray-400">{b.guestEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {b.checkIn} &rarr; {b.checkOut}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900 font-medium">
                    {symbol(b.currency)}{parseFloat(b.grandTotal).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                        b.status === "paid" || b.status === "pms_synced"
                          ? "bg-green-100 text-green-700"
                          : b.status === "cancelled" || b.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {b.createdAt
                      ? new Date(b.createdAt).toLocaleDateString("en-GB")
                      : "—"}
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
