"use client";

interface Issue {
  issue_id: string;
  severity: "critical" | "high" | "medium" | "low" | "warning";
  type: string;
  description: string;
  action_required?: string;
}

interface Props {
  validation?: {
    completeness: "pass" | "fail";
    issues: Issue[];
  };
}

const TYPE_LABELS: Record<string, string> = {
  budget_insufficient:  "Insufficient budget",
  lead_time_infeasible: "Delivery deadline not achievable",
  lead_time_critical:   "Tight delivery window",
  policy_conflict:      "Policy conflict",
  missing_quantity:     "Quantity not specified",
  missing_budget:       "Budget not specified",
  missing_field:        "Missing information",
  deadline_passed:      "Deadline already passed",
  contradictory_request:"Contradictory request",
  restricted_category:  "Restricted category",
};

const SEVERITY_CFG = {
  critical: { label: "Critical", border: "#dc2626", bg: "rgba(220,38,38,0.08)", badgeBg: "rgba(220,38,38,0.15)", badgeColor: "#fca5a5", iconColor: "#dc2626" },
  high:     { label: "High",     border: "#f59e0b", bg: "rgba(245,158,11,0.08)", badgeBg: "rgba(245,158,11,0.15)", badgeColor: "#fcd34d", iconColor: "#f59e0b" },
  warning:  { label: "Warning",  border: "#a78bfa", bg: "rgba(167,139,250,0.08)", badgeBg: "rgba(167,139,250,0.15)", badgeColor: "#c4b5fd", iconColor: "#a78bfa" },
  medium:   { label: "Review",   border: "#6b7280", bg: "rgba(107,114,128,0.06)", badgeBg: "rgba(107,114,128,0.12)", badgeColor: "#9ca3af", iconColor: "#6b7280" },
  low:      { label: "Info",     border: "#6b7280", bg: "rgba(107,114,128,0.06)", badgeBg: "rgba(107,114,128,0.12)", badgeColor: "#9ca3af", iconColor: "#6b7280" },
};

export default function PolicyCheck({ validation }: Props) {
  if (!validation) return null;

  const issues = validation.issues ?? [];
  const pass = validation.completeness === "pass";

  return (
    <div className="w-full max-w-2xl">
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Compliance Checks</span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide"
            style={pass
              ? { backgroundColor: "rgba(34,197,94,0.12)", color: "#22c55e" }
              : { backgroundColor: "rgba(220,38,38,0.12)", color: "#f87171" }
            }
          >
            {pass ? "Pass" : "Fail"}
          </span>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {pass && issues.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-emerald-400" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>✓</span>
              <div>
                <p className="text-sm font-semibold text-emerald-400">All checks passed</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Request is complete and policy-compliant</p>
              </div>
            </div>
          ) : (
            issues.map((iss: Issue, i: number) => {
              const cfg = SEVERITY_CFG[iss.severity] ?? SEVERITY_CFG.medium;
              const title = TYPE_LABELS[iss.type] ?? iss.type?.replace(/_/g, " ");
              return (
                <div
                  key={i}
                  className="rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${cfg.border}40`, backgroundColor: cfg.bg }}
                >
                  <div className="flex items-start gap-3 px-4 pt-3 pb-2">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: cfg.badgeBg, color: cfg.iconColor }}
                    >
                      {iss.severity === "critical" ? "✗" : iss.severity === "high" ? "⚠" : "!"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{title}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ backgroundColor: cfg.badgeBg, color: cfg.badgeColor }}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{iss.description}</p>
                    </div>
                  </div>
                  {iss.action_required && (
                    <div className="mx-4 mb-3 mt-1 flex items-start gap-2 rounded-md px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.04)", borderLeft: `3px solid ${cfg.border}` }}>
                      <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 mt-0.5" style={{ color: cfg.iconColor }}>Action</span>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-main)" }}>{iss.action_required}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
