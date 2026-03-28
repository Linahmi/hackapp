"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → redirect
  useEffect(() => {
    if (!loading && user) {
      router.replace(user.role === "requester" ? "/my-requests" : "/approvals");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Redirect based on role (user state will update, useEffect will fire)
  };

  if (loading) return null;

  return (
    <main className="min-h-[calc(100vh-57px)] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-xl p-8 shadow-sm"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
              ProcureTrace
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[color:var(--text-main)]">Sign in</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            Access your procurement workspace
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              className="w-full rounded-lg px-4 py-2.5 text-sm text-[color:var(--text-main)] outline-none transition-colors"
              style={{
                backgroundColor: "var(--bg-hover)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg px-4 py-2.5 text-sm text-[color:var(--text-main)] outline-none transition-colors"
              style={{
                backgroundColor: "var(--bg-hover)",
                border: "1px solid var(--border-subtle)",
              }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30">
              <AlertCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div
          className="mt-6 rounded-lg p-4"
          style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)] mb-2">
            Demo accounts
          </p>
          <div className="flex flex-col gap-1 text-xs text-[color:var(--text-muted)]">
            <div className="flex justify-between">
              <span>alice@company.com</span>
              <span className="font-mono">alice123</span>
              <span className="text-indigo-500 font-medium">manager</span>
            </div>
            <div className="flex justify-between">
              <span>requester@company.com</span>
              <span className="font-mono">req123</span>
              <span className="text-emerald-500 font-medium">requester</span>
            </div>
            <div className="flex justify-between">
              <span>admin@company.com</span>
              <span className="font-mono">admin123</span>
              <span className="text-amber-500 font-medium">admin</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
