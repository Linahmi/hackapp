"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, XCircle, RefreshCw, Inbox, AlertCircle, X } from "lucide-react";

interface ApprovalItem {
  request_id: string;
  approval_status: string;
  required_approver: string | null;
  submitted_at: string;
  confidence: number | null;
  category: string | null;
  quantity: number | null;
  budget: number | null;
  currency: string | null;
  case_type: string | null;
  decision_status: string | null;
  top_supplier: string | null;
  requester: string;
  escalation_reason: string | null;
}

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUBMITTED:       { label: "Submitted",      color: "#1d4ed8", bg: "#eff6ff" },
  APPROVED:        { label: "Approved",       color: "#16a34a", bg: "#f0fdf4" },
  AUTO_APPROVED:   { label: "Auto-approved",  color: "#16a34a", bg: "#f0fdf4" },
  REJECTED:        { label: "Rejected",       color: "#dc2626", bg: "#fef2f2" },
  PENDING_APPROVAL:{ label: "Pending",        color: "#d97706", bg: "#fef3c7" },
  PROCESSING:      { label: "Processing",     color: "#9ca3af", bg: "#f3f4f6" },
};

interface ModalState {
  action: "approve" | "reject";
  item: ApprovalItem;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatBudget(amount: number | null, currency: string | null) {
  if (!amount) return null;
  return `${currency ?? "EUR"} ${new Intl.NumberFormat("en").format(amount)}`;
}

function ConfirmModal({
  modal,
  onClose,
  onConfirm,
}: {
  modal: ModalState;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}) {
  const [comment, setComment]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const isApprove = modal.action === "approve";

  const handleConfirm = async () => {
    if (!isApprove && !comment.trim()) {
      setError("A reason is required when rejecting.");
      return;
    }
    setLoading(true);
    await onConfirm(comment);
    setLoading(false);
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-xl p-6 flex flex-col gap-5"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)] mb-1">
              {isApprove ? "Confirm approval" : "Confirm rejection"}
            </p>
            <h2 className="text-lg font-bold text-[color:var(--text-main)]">
              {isApprove ? "Approve" : "Reject"} {modal.item.request_id}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Request summary */}
        <div
          className="rounded-lg p-4 flex flex-col gap-1.5 text-sm"
          style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}
        >
          {modal.item.category && (
            <div className="flex justify-between">
              <span className="text-[color:var(--text-muted)]">Category</span>
              <span className="font-medium text-[color:var(--text-main)]">{modal.item.category}</span>
            </div>
          )}
          {modal.item.budget && (
            <div className="flex justify-between">
              <span className="text-[color:var(--text-muted)]">Budget</span>
              <span className="font-medium text-[color:var(--text-main)]">
                {formatBudget(modal.item.budget, modal.item.currency)}
              </span>
            </div>
          )}
          {modal.item.top_supplier && (
            <div className="flex justify-between">
              <span className="text-[color:var(--text-muted)]">Top supplier</span>
              <span className="font-medium text-[color:var(--text-main)]">{modal.item.top_supplier}</span>
            </div>
          )}
          {modal.item.confidence !== null && (
            <div className="flex justify-between">
              <span className="text-[color:var(--text-muted)]">AI confidence</span>
              <span className="font-medium text-[color:var(--text-main)]">{modal.item.confidence}%</span>
            </div>
          )}
        </div>

        {/* Comment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
            {isApprove ? "Comment (optional)" : "Reason for rejection *"}
          </label>
          <textarea
            value={comment}
            onChange={(e) => { setComment(e.target.value); setError(""); }}
            rows={3}
            placeholder={isApprove ? "Add a note…" : "Explain why this request is being rejected…"}
            className="w-full rounded-lg px-4 py-2.5 text-sm text-[color:var(--text-main)] resize-none outline-none"
            style={{
              backgroundColor: "var(--bg-hover)",
              border: `1px solid ${error ? "#dc2626" : "var(--border-subtle)"}`,
            }}
          />
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: isApprove ? "#22c55e" : "#dc2626" }}
          >
            {loading && <RefreshCw size={13} className="animate-spin" />}
            {isApprove ? "Confirm Approve" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [items, setItems]     = useState<ApprovalItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [modal, setModal]     = useState<ModalState | null>(null);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role === "requester") router.replace("/my-requests");
  }, [user, loading, router]);

  const fetchApprovals = useCallback(() => {
    if (!user) return;
    setFetching(true);
    fetch("/api/approvals", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setItems(data.items ?? []); setFetching(false); })
      .catch(() => setFetching(false));
  }, [user]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleConfirm = async (comment: string) => {
    if (!modal) return;
    const { action, item } = modal;

    const res = await fetch(`/api/requests/${item.request_id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ comment }),
    });

    setModal(null);

    if (res.ok) {
      setToast({ msg: `${item.request_id} ${action === "approve" ? "approved" : "rejected"} successfully.`, ok: true });
      fetchApprovals();
    } else {
      const data = await res.json();
      setToast({ msg: data.error ?? "Something went wrong.", ok: false });
    }

    setTimeout(() => setToast(null), 4000);
  };

  if (loading || !user) return null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
              Manager
            </span>
          </div>
          <h1 className="text-3xl font-bold text-[color:var(--text-main)]">Approval Queue</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            {user.title ?? user.name} · {items.length} pending
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[color:var(--text-muted)] hover:text-[color:var(--text-main)] hover:bg-white/5 transition-colors"
          style={{ border: "1px solid var(--border-subtle)" }}
        >
          <RefreshCw size={14} className={fetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* List */}
      {fetching ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-[color:var(--text-muted)]" />
        </div>
      ) : items.length === 0 ? (
        <div
          className="rounded-xl p-12 flex flex-col items-center gap-3 text-center"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
        >
          <Inbox size={32} className="text-[color:var(--text-muted)] opacity-40" />
          <p className="font-semibold text-[color:var(--text-main)]">Queue is empty</p>
          <p className="text-sm text-[color:var(--text-muted)]">
            No pending requests for {user.title ?? "your role"} right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.request_id}
              className="rounded-xl p-5"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-red-600">{item.request_id}</span>
                    {item.decision_status && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: item.decision_status === "recommended" ? "#22c55e" : "#dc2626",
                          backgroundColor: item.decision_status === "recommended" ? "#22c55e18" : "#dc262618",
                        }}
                      >
                        {item.decision_status === "recommended" ? "Recommended" : "Cannot proceed"}
                      </span>
                    )}
                    {item.approval_status && APPROVAL_STATUS_CONFIG[item.approval_status] && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          color: APPROVAL_STATUS_CONFIG[item.approval_status].color,
                          backgroundColor: APPROVAL_STATUS_CONFIG[item.approval_status].bg,
                        }}
                      >
                        {APPROVAL_STATUS_CONFIG[item.approval_status].label}
                      </span>
                    )}
                    {item.confidence !== null && (
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {item.confidence}% confidence
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-[color:var(--text-main)]">
                    {item.category ?? "Unknown category"}
                  </p>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-[color:var(--text-muted)] font-semibold">
                      Requester: {item.requester}
                    </span>
                    {item.quantity && (
                      <span className="text-xs text-[color:var(--text-muted)]">Qty {item.quantity}</span>
                    )}
                    {item.budget && (
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {formatBudget(item.budget, item.currency)}
                      </span>
                    )}
                    {item.top_supplier && (
                      <span className="text-xs text-[color:var(--text-muted)]">
                        Top: {item.top_supplier}
                      </span>
                    )}
                    <span className="text-xs text-[color:var(--text-muted)]">
                      Submitted {formatDate(item.submitted_at)}
                    </span>
                  </div>

                  {item.escalation_reason && (
                    <p className="text-xs mt-2 p-2 rounded bg-red-50 text-red-700 border border-red-100">
                      <span className="font-bold">Escalation Reason:</span> {item.escalation_reason}
                    </p>
                  )}
                  {item.required_approver && !item.escalation_reason && (
                    <p className="text-xs text-[color:var(--text-muted)] mt-1">
                      Requires: <span className="font-medium text-[color:var(--text-main)]">{item.required_approver}</span>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setModal({ action: "reject", item })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      color: "#dc2626",
                      backgroundColor: "#dc262610",
                      border: "1px solid #dc262630",
                    }}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <button
                    onClick={() => setModal({ action: "approve", item })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{
                      color: "#22c55e",
                      backgroundColor: "#22c55e10",
                      border: "1px solid #22c55e30",
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal */}
      {modal && (
        <ConfirmModal
          modal={modal}
          onClose={() => setModal(null)}
          onConfirm={handleConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 shadow-lg text-sm font-semibold text-white"
          style={{ backgroundColor: toast.ok ? "#22c55e" : "#dc2626" }}
        >
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </main>
  );
}
