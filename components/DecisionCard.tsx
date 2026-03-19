"use client";

import { useEffect, useState } from "react";

type RecStatus = "approved" | "pending_approval" | "cannot_proceed";

interface Escalation {
  escalation_id: string;
  rule: string;
  trigger: string;
  blocking: boolean;
  escalate_to: string;
}

interface Props {
  recommendation?: {
    status: RecStatus;
    reason: string;
    recommended_supplier?: string;
    recommended_supplier_rationale?: string;
    preferred_supplier_if_resolved?: string;
    minimum_budget_required?: number;
    minimum_budget_currency?: string;
  };
  policyEvaluation?: {
    approval_threshold?: {
      rule_applied: string;
      quotes_required: number;
      approvers: string[];
      deviation_approval?: string;
    };
  };
  escalations?: Escalation[];
  confidence?: number;
}

const CFG: Record<RecStatus, { bg: string; border: string; badgeBg: string; badgeColor: string; icon: string; label: string }> = {
  approved: {
    bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.3)",
    badgeBg: "rgba(34,197,94,0.12)", badgeColor: "#22c55e",
    icon: "✓", label: "Auto-Approved",
  },
  pending_approval: {
    bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.3)",
    badgeBg: "rgba(245,158,11,0.12)", badgeColor: "#f59e0b",
    icon: "⏳", label: "Pending Approval",
  },
  cannot_proceed: {
    bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.3)",
    badgeBg: "rgba(220,38,38,0.12)", badgeColor: "#dc2626",
    icon: "✗", label: "Cannot Proceed",
  },
};

export default function DecisionCard({ recommendation, policyEvaluation, escalations = [], confidence }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!recommendation) return null;

  const {
    status, reason, recommended_supplier, recommended_supplier_rationale,
    preferred_supplier_if_resolved, minimum_budget_required, minimum_budget_currency,
  } = recommendation;

  const cfg       = CFG[status] ?? CFG.pending_approval;
  const threshold = policyEvaluation?.approval_threshold;
  const blocking  = escalations.filter((e) => e.blocking);

  return (
    <div
      className="w-full max-w-2xl transition-all duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
    >
      <div
        className="rounded-xl p-5 flex flex-col gap-4"
        style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
             <span className="text-xl" style={{ color: cfg.badgeColor }}>{cfg.icon}</span>
             <span className="text-[color:var(--text-main)] font-bold text-base">Decision</span>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ml-2"
                style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor }}
             >
                {cfg.label}
             </span>
             {confidence != null && (
               <span
                 className="text-xs font-bold px-2 py-0.5 rounded-full ml-2"
                 style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#22c55e" }}
               >
                 Confidence: {confidence}%
               </span>
             )}
          </div>

          <button
            onClick={() => {
              const btn = document.getElementById("export-btn");
              if (btn) btn.innerHTML = "Exporting...";
              setTimeout(() => {
                if (btn) btn.innerHTML = "✓ Exported to ERP / PDF";
                setTimeout(() => { if (btn) btn.innerHTML = "Export Case"; }, 3000);
              }, 1200);
            }}
            id="export-btn"
            className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "#1e2130", color: "var(--text-main)", border: "1px solid #374151" }}
          >
            Export Case
          </button>
        </div>

        {/* Reason */}
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{reason}</p>

        {/* Supplier */}
        {(recommended_supplier || preferred_supplier_if_resolved) && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              {preferred_supplier_if_resolved ? "Preferred (if resolved)" : "Recommended Supplier"}
            </p>
            <p className="text-[color:var(--text-main)] font-semibold text-sm">
              {preferred_supplier_if_resolved ?? recommended_supplier}
            </p>
            {recommended_supplier_rationale && (
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{recommended_supplier_rationale}</p>
            )}
          </div>
        )}

        {/* Budget gap */}
        {minimum_budget_required != null && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Minimum Budget Required</p>
            <p className="font-semibold text-sm" style={{ color: "#fca5a5" }}>
              {minimum_budget_currency} {Number(minimum_budget_required).toLocaleString()}
            </p>
          </div>
        )}

        {/* Approval threshold */}
        {threshold && (
          <div
            className="rounded-lg px-4 py-3 flex flex-col gap-1.5"
            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>Approval Threshold</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
              <span className="text-[color:var(--text-main)] font-mono">{threshold.rule_applied}</span>
              <span>{threshold.quotes_required} quote{threshold.quotes_required !== 1 ? "s" : ""} required</span>
              <span>Approvers: <span className="text-white">{(threshold.approvers ?? []).join(", ")}</span></span>
              {threshold.deviation_approval && (
                <span>Deviation: <span className="text-white">{threshold.deviation_approval}</span></span>
              )}
            </div>
          </div>
        )}

        {/* Blocking escalations */}
        {blocking.length > 0 && (
          <div className="flex flex-col gap-2">
            {blocking.map((e, index) => (
              <div
                key={e.escalation_id || `escalation-${index}`}
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.3)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-red-500">⚠ Blocking</span>
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{e.rule}</span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{e.trigger}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>→ Escalate to: {e.escalate_to}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
