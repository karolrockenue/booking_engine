"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";

const AdminAuthContext = createContext<{
  token: string;
  setToken: (t: string) => void;
}>({ token: "", setToken: () => {} });

export function useAdminToken() {
  return useContext(AdminAuthContext).token;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) setToken(saved);
    setChecked(true);
  }, []);

  function handleLogin() {
    localStorage.setItem("admin_token", input);
    setToken(input);
  }

  if (!checked) return null;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-sm border max-w-sm w-full">
          <h1 className="text-xl font-bold mb-4 text-gray-900">Admin Login</h1>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin token"
            className="w-full px-3 py-2 border rounded text-sm mb-4 text-gray-900"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="w-full py-2 bg-gray-900 text-white rounded text-sm font-medium"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={{ token, setToken }}>
      <div className="min-h-screen bg-gray-50">
        {/* Admin top bar */}
        <header className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/admin" className="font-bold text-sm">
              Booking Engine Admin
            </a>
            <nav className="flex gap-4 text-sm text-gray-300">
              <a href="/admin" className="hover:text-white">
                Properties
              </a>
              <a href="/admin/bookings" className="hover:text-white">
                Bookings
              </a>
            </nav>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("admin_token");
              setToken("");
            }}
            className="text-xs text-gray-400 hover:text-white"
          >
            Logout
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </AdminAuthContext.Provider>
  );
}
