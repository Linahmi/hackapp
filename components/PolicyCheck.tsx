"use client";

import { useEffect, useState } from "react";

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
    issues_detected: Issue[];
  };
}

type Status = "pass" | "critical" | "high" | "human" | "warning";

const STATUS_CFG: Record<Status, { symbol: string; color: string; bg: string; badge: string; tooltip: string }> = {
  pass:     { symbol: "✓", color: "#22c55e", bg: "rgba(34,197,94,0.06)",  badge: "Pass",          tooltip: "This check passed — the request meets all policy requirements for this field." },
  critical: { symbol: "✗", color: "#dc2626", bg: "rgba(220,38,38,0.10)",  badge: "Critical",      tooltip: "Critical failure — this field is missing or invalid and must be corrected before the request can proceed." },
  high:     { symbol: "⚠", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", badge: "High",          tooltip: "High severity — this issue may delay processing or lead to compliance problems." },
  warning:  { symbol: "?", color: "#a78bfa", bg: "rgba(167,139,250,0.10)", badge: "Contradiction", tooltip: "Contradiction detected — conflicting information was found in the request." },
  human:    { symbol: "!", color: "var(--text-main)", bg: "rgba(255,255,255,0.04)", badge: "Review", tooltip: "Human review required — an analyst must validate this item manually." },
};

function toStatus(severity: string): Status {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "warning") return "warning";
  if (severity === "medium") return "human";
  return "pass";
}

export default function PolicyCheck({ validation }: Props) {
  const [count, setCount] = useState(0);

  const issues = (validation as any)?.issues ?? validation?.issues_detected ?? [];
  const items: { label: string; detail: string; status: Status }[] =
    issues.length > 0
      ? issues.map((iss: Issue) => ({
          label:  iss.type || iss.issue_id,
          detail: iss.description,
          status: toStatus(iss.severity),
        }))
      : [{ label: "All checks passed", detail: "Request is complete and policy-compliant", status: "pass" }];

  useEffect(() => {
    if (count >= items.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), 220);
    return () => clearTimeout(id);
  }, [count, items.length]);

  if (!validation) return null;

  const pass = validation.completeness === "pass";

  return (
    <div className="w-full max-w-2xl">
      <div
        className="rounded-xl p-5 flex flex-col gap-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            <span className="text-[color:var(--text-main)] text-sm font-semibold">Compliance Checks</span>
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: pass ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.12)",
              color: pass ? "#22c55e" : "#dc2626",
            }}
          >
            {pass ? "Pass" : "Fail"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {items.map(({ label, detail, status }, i) => {
            const cfg  = STATUS_CFG[status];
            const show = i < count;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-300"
                style={{
                  backgroundColor: cfg.bg,
                  border: "1px solid rgba(255,255,255,0.04)",
                  opacity: show ? 1 : 0,
                  transform: show ? "translateX(0)" : "translateX(-8px)",
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", color: cfg.color }}
                >
                  {cfg.symbol}
                </span>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-sm font-medium text-[color:var(--text-main)]">{label}</span>
                  <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{detail}</span>
                </div>

                {/* Vibrating ? icon with hover tooltip */}
                <div className="relative group/tip shrink-0">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-help animate-wiggle"
                    style={{
                      backgroundColor: cfg.bg,
                      color: cfg.color,
                      border: `1.5px solid ${cfg.color}`,
                    }}
                  >
                    ?
                  </span>
                  <div className="absolute bottom-full right-0 mb-2 w-64 px-3 py-2.5 rounded-lg text-xs font-medium leading-relaxed shadow-lg opacity-0 scale-95 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:scale-100 group-hover/tip:pointer-events-auto transition-all duration-200 z-50 bg-gray-900 dark:bg-gray-800 text-white border border-gray-700">
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5" style={{ color: cfg.color }}>{cfg.symbol}</span>
                      <span>{status === "pass" ? cfg.tooltip : `${cfg.tooltip} — ${detail}`}</span>
                    </div>
                    <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-800 border-r border-b border-gray-700" />
                  </div>
                </div>

                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                  style={{ color: cfg.color, backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  {cfg.badge}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
