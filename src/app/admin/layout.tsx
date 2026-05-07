"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";

const AdminAuthContext = createContext<{
  token: string;
  setToken: (t: string) => void;
  logout: () => void;
}>({ token: "", setToken: () => {}, logout: () => {} });

export function useAdminToken() {
  return useContext(AdminAuthContext).token;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
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

  function logout() {
    localStorage.removeItem("admin_token");
    setToken("");
  }

  if (!checked) return null;

  if (!token) {
    return (
      <div className="admin-root min-h-screen flex items-center justify-center" style={{ background: "var(--a-side)" }}>
        <div
          className="bg-white p-8 rounded-md border max-w-sm w-full"
          style={{ borderColor: "var(--a-border)" }}
        >
          <h1 className="text-[18px] font-semibold mb-4">Admin login</h1>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin token"
            className="w-full px-3 py-2 border rounded text-[13px] mb-4 focus:outline-none focus:border-[var(--a-accent)]"
            style={{ borderColor: "var(--a-border)" }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <button
            onClick={handleLogin}
            className="w-full py-2 text-white rounded text-[13px] font-medium"
            style={{ background: "var(--a-ink)" }}
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={{ token, setToken, logout }}>
      <div className="admin-root">{children}</div>
    </AdminAuthContext.Provider>
  );
}
