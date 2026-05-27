"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Wordmark } from "@/components/rockenue/Wordmark";

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
    // Strip ALL whitespace — pasted tokens can pick up line breaks or spaces
    // from terminal wrapping, and the token is hex so spaces are never valid.
    const cleaned = input.replace(/\s+/g, "");
    localStorage.setItem("admin_token", cleaned);
    setToken(cleaned);
  }

  function logout() {
    localStorage.removeItem("admin_token");
    setToken("");
  }

  if (!checked) return null;

  if (!token) {
    return <AdminLogin input={input} setInput={setInput} onSubmit={handleLogin} />;
  }

  return (
    <AdminAuthContext.Provider value={{ token, setToken, logout }}>
      <div className="admin-root">{children}</div>
    </AdminAuthContext.Provider>
  );
}

const LOGIN_BG = "#14181D";
const LOGIN_INK = "#F4F2EC";
const LOGIN_MUTED = "#8A9099";
const LOGIN_HAIR = "rgba(255,255,255,0.16)";
const LOGIN_GOLD = "#C8A66E";

function AdminLogin({
  input,
  setInput,
  onSubmit,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100svh",
        background: LOGIN_BG,
        color: LOGIN_INK,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px clamp(20px, 5vw, 56px)",
          width: "100%",
        }}
      >
        <div style={{ marginBottom: 56 }}>
          <Wordmark variant="dark" size="md" />
        </div>

        <div style={{ width: "100%", maxWidth: 360 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              color: LOGIN_MUTED,
              textTransform: "uppercase",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            Admin access
          </div>

          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin token"
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            autoFocus
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              borderBottom: `1px solid ${LOGIN_HAIR}`,
              outline: "none",
              color: LOGIN_INK,
              fontSize: 15,
              fontWeight: 300,
              padding: "12px 2px",
              textAlign: "center",
              letterSpacing: "0.04em",
              fontFamily: "inherit",
            }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = LOGIN_GOLD)}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = LOGIN_HAIR)}
          />

          <button
            onClick={onSubmit}
            style={{
              marginTop: 36,
              width: "100%",
              background: "transparent",
              color: LOGIN_INK,
              border: `1px solid ${LOGIN_HAIR}`,
              borderRadius: 7,
              padding: "12px 18px",
              fontSize: 13,
              fontWeight: 400,
              fontFamily: "inherit",
              cursor: "pointer",
              letterSpacing: "0.02em",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = LOGIN_GOLD;
              e.currentTarget.style.color = LOGIN_GOLD;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = LOGIN_HAIR;
              e.currentTarget.style.color = LOGIN_INK;
            }}
          >
            Sign in →
          </button>
        </div>
      </main>

      <footer
        style={{
          padding: "22px clamp(20px, 5vw, 56px)",
          textAlign: "center",
          fontSize: 12,
          color: LOGIN_MUTED,
        }}
      >
        Rockenue Tech sp. z o.o.  ·  Kraków
      </footer>
    </div>
  );
}
