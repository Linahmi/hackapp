"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, CheckCircle2, XCircle, Zap, RefreshCw, FileText } from "lucide-react";

interface RequestItem {
  request_id: string;
  category: string | null;
  quantity: number | null;
  budget: number | null;
  submitted_at: string | null;
  ai_status: string | null;
  approval_status: string;
  decided_by: string | null;
  decided_at: string | null;
  comment: string | null;
}

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  APPROVED:        { label: "Approved",       color: "#22c55e", icon: <CheckCircle2 size={13} /> },
  AUTO_APPROVED:   { label: "Auto-approved",  color: "#6366f1", icon: <Zap size={13} /> },
  REJECTED:        { label: "Rejected",       color: "#dc2626", icon: <XCircle size={13} /> },
  PENDING_APPROVAL:{ label: "Pending",        color: "#f59e0b", icon: <Clock size={13} /> },
  PROCESSING:      { label: "Processing",     color: "#9ca3af", icon: <RefreshCw size={13} className="animate-spin" /> },
};

const AI_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  recommended:    { label: "Recommended",   color: "#22c55e" },
  cannot_proceed: { label: "Cannot proceed", color: "#dc2626" },
  partial_match:  { label: "Partial match",  color: "#f59e0b" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatBudget(amount: number | null) {
  if (!amount) return null;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(amount);
}

export default function MyRequestsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [requests, setRequests]   = useState<RequestItem[]>([]);
  const [fetching, setFetching]   = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/requests/mine", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setRequests(data.items ?? []);
        setFetching(false);
      })
      .catch(() => setFetching(false));
  }, [user]);

  if (loading || !user) return null;

  const counts = {
    total:   requests.length,
    pending: requests.filter((r) => r.approval_status === "PENDING_APPROVAL").length,
    approved: requests.filter((r) => ["APPROVED", "AUTO_APPROVED"].includes(r.approval_status)).length,
    rejected: requests.filter((r) => r.approval_status === "REJECTED").length,
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
            Requester
          </span>
        </div>
        <h1 className="text-3xl font-bold text-[color:var(--text-main)]">My Requests</h1>
        <p className="text-sm text-[color:var(--text-muted)] mt-1">
          Requests submitted by {user.name}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total",    value: counts.total,    color: "var(--text-main)" },
          { label: "Pending",  value: counts.pending,  color: "#f59e0b" },
          { label: "Approved", value: counts.approved, color: "#22c55e" },
          { label: "Rejected", value: counts.rejected, color: "#dc2626" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)] mb-1">
              {label}
            </p>
            <p className="text-2xl font-bold" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Request list */}
      {fetching ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-[color:var(--text-muted)]" />
        </div>
      ) : requests.length === 0 ? (
        <div
          className="rounded-xl p-12 flex flex-col items-center gap-3 text-center"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
        >
          <FileText size={32} className="text-[color:var(--text-muted)] opacity-40" />
          <p className="font-semibold text-[color:var(--text-main)]">No requests yet</p>
          <p className="text-sm text-[color:var(--text-muted)]">
            Submit a request from the{" "}
            <a href="/" className="text-red-600 hover:underline underline-offset-2">
              Client Portal
            </a>
            , then claim it to track it here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => {
            const approvalCfg = APPROVAL_STATUS_CONFIG[req.approval_status] ?? APPROVAL_STATUS_CONFIG.PROCESSING;
            const aiCfg = req.ai_status ? AI_STATUS_CONFIG[req.ai_status] : null;

            return (
              <div
                key={req.request_id}
                className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors hover:bg-[var(--bg-hover)]"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
              >
                {/* Left: ID + category */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-red-600">{req.request_id}</span>
                    {aiCfg && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: aiCfg.color, backgroundColor: `${aiCfg.color}18` }}
                      >
                        {aiCfg.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[color:var(--text-main)] truncate">
                    {req.category ?? "Unknown category"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {req.quantity && (
                      <span className="text-xs text-[color:var(--text-muted)]">Qty {req.quantity}</span>
                    )}
                    {req.budget && (
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {formatBudget(req.budget)}
                      </span>
                    )}
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {formatDate(req.submitted_at)}
                    </span>
                  </div>
                  {req.comment && (
                    <p className="text-xs text-[color:var(--text-muted)] mt-1 italic">
                      "{req.comment}"
                    </p>
                  )}
                </div>

                {/* Right: approval status badge */}
                <div className="shrink-0">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                    style={{
                      color: approvalCfg.color,
                      backgroundColor: `${approvalCfg.color}18`,
                    }}
                  >
                    {approvalCfg.icon}
                    {approvalCfg.label}
                  </span>
                  {req.decided_at && (
                    <p className="text-xs text-[color:var(--text-muted)] text-right mt-1">
                      {formatDate(req.decided_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
