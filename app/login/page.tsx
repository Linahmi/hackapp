"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Loader2 } from "lucide-react";

type Tab = "login" | "register";

export default function LoginPage() {
  const { user, login, register, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab]           = useState<Tab>("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → redirect
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "requester" ? "/my-requests" : "/approvals");
    }
  }, [user, loading, router]);

  const resetForm = () => {
    setName(""); setEmail(""); setPassword(""); setConfirm(""); setError("");
  };

  const switchTab = (t: Tab) => { setTab(t); resetForm(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (tab === "register") {
      if (password !== confirm) { setError("Passwords do not match"); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    }

    setSubmitting(true);

    const result = tab === "login"
      ? await login(email, password)
      : await register(name, email, password);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
    // On success: useEffect above handles redirect
  };

  if (loading) return null;

  const inputClass = "w-full rounded-lg px-4 py-2.5 text-sm text-[color:var(--text-main)] outline-none transition-colors";
  const inputStyle = { backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" };

  return (
    <main className="min-h-[calc(100vh-57px)] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-xl p-8 shadow-sm"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        {/* Header */}
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
            ProcureTrace
          </span>
          <h1 className="text-2xl font-bold text-[color:var(--text-main)] mt-1">
            {tab === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            {tab === "login"
              ? "Access your procurement workspace"
              : "Join as a requester — free access"}
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-lg p-1 mb-6 gap-1"
          style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
        >
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className="flex-1 py-1.5 rounded-md text-sm font-semibold transition-colors"
              style={{
                backgroundColor: tab === t ? "var(--bg-card)" : "transparent",
                color: tab === t ? "var(--text-main)" : "var(--text-muted)",
                border: tab === t ? "1px solid var(--border-subtle)" : "1px solid transparent",
              }}
            >
              {t === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tab === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                Full name
              </label>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Smith"
                className={inputClass}
                style={inputStyle}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              Password
            </label>
            <input
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {tab === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className={inputClass}
                style={{
                  ...inputStyle,
                  borderColor: confirm && confirm !== password ? "#dc2626" : "var(--border-subtle)",
                }}
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-600">Passwords do not match</p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting
              ? tab === "login" ? "Signing in…" : "Creating account…"
              : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        {/* Demo credentials — only on login tab */}
        {tab === "login" && (
          <div
            className="mt-6 rounded-lg p-4"
            style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)] mb-2">
              Demo accounts
            </p>
            <div className="flex flex-col gap-1.5 text-xs text-[color:var(--text-muted)]">
              {[
                { email: "alice@company.com",     pwd: "alice123",  role: "manager",   color: "#6366f1" },
                { email: "requester@company.com", pwd: "req123",    role: "requester", color: "#22c55e" },
                { email: "admin@company.com",     pwd: "admin123",  role: "admin",     color: "#f59e0b" },
              ].map(({ email: e, pwd, role, color }) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmail(e); setPassword(pwd); }}
                  className="flex justify-between items-center hover:opacity-80 transition-opacity text-left"
                >
                  <span>{e}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{pwd}</span>
                    <span className="font-semibold" style={{ color }}>{role}</span>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-[color:var(--text-muted)] mt-2 opacity-60">
              Click a row to auto-fill
            </p>
          </div>
        )}

        {tab === "register" && (
          <p className="text-xs text-center text-[color:var(--text-muted)] mt-4">
            New accounts are created as <span className="font-semibold text-[color:var(--text-main)]">requester</span>.
            Contact an admin to get manager access.
          </p>
        )}
      </div>
    </main>
  );
}
