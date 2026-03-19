const STATUS_STYLES = {
  approved:        { bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-800", icon: "✓" },
  pending_approval:{ bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-800", icon: "⏳" },
  cannot_proceed:  { bg: "bg-red-50",   border: "border-red-200",   badge: "bg-red-100 text-red-800",   icon: "✗" },
};

export default function RecommendationCard({ recommendation, policyEvaluation }) {
  if (!recommendation) return null;

  const { status, reason, preferred_supplier_if_resolved, preferred_supplier_rationale,
          recommended_supplier, recommended_supplier_rationale,
          minimum_budget_required, minimum_budget_currency } = recommendation;

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending_approval;
  const threshold = policyEvaluation?.approval_threshold;

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} shadow-sm`}>
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">Recommendation</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${style.badge}`}>
          {style.icon} {status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-zinc-700">{reason}</p>

        {(preferred_supplier_if_resolved || recommended_supplier) && (
          <div className="rounded-lg bg-white/60 px-4 py-3 border border-black/5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">
              {preferred_supplier_if_resolved ? "Preferred Supplier (if resolved)" : "Recommended Supplier"}
            </p>
            <p className="text-sm font-semibold text-zinc-800">
              {preferred_supplier_if_resolved ?? recommended_supplier}
            </p>
            {(preferred_supplier_rationale ?? recommended_supplier_rationale) && (
              <p className="mt-1 text-xs text-zinc-500">
                {preferred_supplier_rationale ?? recommended_supplier_rationale}
              </p>
            )}
          </div>
        )}

        {minimum_budget_required && (
          <div className="rounded-lg bg-white/60 px-4 py-3 border border-black/5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">Minimum Budget Required</p>
            <p className="text-sm font-semibold text-zinc-800">
              {minimum_budget_currency} {Number(minimum_budget_required).toLocaleString()}
            </p>
          </div>
        )}

        {threshold && (
          <div className="rounded-lg bg-white/60 px-4 py-3 border border-black/5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1">Approval Threshold</p>
            <div className="flex flex-wrap gap-4 text-sm text-zinc-700">
              <span><span className="font-mono font-medium text-zinc-800">{threshold.rule_applied}</span> — {threshold.quotes_required} quote{threshold.quotes_required !== 1 ? "s" : ""} required</span>
              <span>Approvers: <span className="font-medium">{(threshold.approvers ?? []).join(", ")}</span></span>
              {threshold.deviation_approval && (
                <span>Deviation: <span className="font-medium">{threshold.deviation_approval}</span></span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
