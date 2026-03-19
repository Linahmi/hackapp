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

export default function DecisionCard({ recommendation, policyEvaluation, escalations = [] }: Props) {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{cfg.icon}</span>
            <span className="text-white font-bold text-base">Decision</span>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor }}
          >
            {cfg.label}
          </span>
        </div>

        {/* Reason */}
        <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>{reason}</p>

        {/* Supplier */}
        {(recommended_supplier || preferred_supplier_if_resolved) && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>
              {preferred_supplier_if_resolved ? "Preferred (if resolved)" : "Recommended Supplier"}
            </p>
            <p className="text-white font-semibold text-sm">
              {preferred_supplier_if_resolved ?? recommended_supplier}
            </p>
            {recommended_supplier_rationale && (
              <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>{recommended_supplier_rationale}</p>
            )}
          </div>
        )}

        {/* Budget gap */}
        {minimum_budget_required != null && (
          <div
            className="rounded-lg px-4 py-3"
            style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Minimum Budget Required</p>
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
            <p className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "#6b7280" }}>Approval Threshold</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: "#9ca3af" }}>
              <span className="text-white font-mono">{threshold.rule_applied}</span>
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
            {blocking.map((e) => (
              <div
                key={e.escalation_id}
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: "#f59e0b" }}>⚠ Blocking</span>
                  <span className="text-xs font-mono" style={{ color: "#6b7280" }}>{e.rule}</span>
                </div>
                <p className="text-sm" style={{ color: "#d1d5db" }}>{e.trigger}</p>
                <p className="text-xs mt-1" style={{ color: "#9ca3af" }}>→ Escalate to: {e.escalate_to}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
