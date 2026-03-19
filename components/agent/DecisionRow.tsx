"use client";

import { useEffect, useState } from "react";

export type DecisionRowProps = {
  bestName: string;
  bestScore: number | null;
  bestPrice: string;
  isAutoApproved: boolean;
  status?: string;
  escalations?: any[];
};

export function DecisionRow({ bestName, bestScore, bestPrice, isAutoApproved, status = "pending_approval", escalations = [] }: DecisionRowProps) {
  const [approved, setApproved] = useState(false);

  // Reset if best supplier changes (slider moved after approval)
  useEffect(() => {
    setApproved(false);
  }, [bestName]);

  const hasEligible = bestName !== "" && bestScore !== null;

  function handleApprove() {
    setApproved(true);
  }

  function handleReview() {
    document.getElementById("supplier-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="rounded-xl shadow-sm mt-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
      {/* Header row */}
      <div className="flex justify-between items-center px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center rounded-full border border-[#C8102E]/50 bg-[#C8102E]/20 px-2.5 py-0.5 text-xs font-semibold text-[#C8102E]">
            Urgent procurement request
          </span>
        </div>

        {/* Decision status indicator — non-interactive */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Decision status
          </span>
          {approved ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/50 bg-emerald-900/30 px-3 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Approved
            </span>
          ) : hasEligible ? (
            isAutoApproved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/50 bg-emerald-900/30 px-3 py-0.5 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Handled automatically
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/50 bg-amber-900/30 px-3 py-0.5 text-xs font-medium text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Requires human review
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-card)", color: "var(--text-muted)" }}>
              No decision
            </span>
          )}
        </div>
      </div>

      {/* Decision body */}
      <div className="px-5 py-5">
        {hasEligible ? (
          approved ? (
            /* ── Success state ── */
            <div
              className="rounded-lg border border-emerald-700/50 bg-emerald-900/15 px-5 py-4"
              style={{ borderLeft: "3px solid #10B981" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-700/50 bg-emerald-900/60">
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>Supplier approved</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Workflow started successfully · {bestName}</p>
                </div>
              </div>
            </div>
          ) : status === "cannot_proceed" ? (
            /* ── Cannot Proceed state ── */
            <div
              className="rounded-lg border border-red-700/50 bg-red-900/15 px-5 py-4"
              style={{ borderLeft: "3px solid #EF4444" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-700/50 bg-red-900/40">
                    <span className="text-red-500 font-bold mb-0.5 text-lg">✗</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-0.5 text-red-500">
                      Cannot proceed
                    </p>
                    <p className="text-base font-bold" style={{ color: "var(--text-main)" }}>Blocking Issues Detected</p>
                    <p className="text-sm mt-0.5 mb-2" style={{ color: "var(--text-muted)" }}>Manual intervention required before sourcing can proceed</p>
                    {escalations && escalations.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        {escalations.filter(e => e.blocking).map((e, i) => (
                          <div key={i} className="text-xs rounded bg-red-950/40 border border-red-900/50 px-2.5 py-1.5 text-red-200">
                            <span className="font-semibold text-red-400">{e.rule}:</span> {e.trigger}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    onClick={handleReview}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-card)", color: "var(--text-main)" }}
                  >
                    Review details
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Default decision card ── */
            <div
              className={`rounded-lg border px-5 py-4 ${
                isAutoApproved
                  ? "border-emerald-700/50 bg-emerald-900/15"
                  : "border-amber-700/30 bg-amber-900/10"
              }`}
              style={{ borderLeft: `3px solid ${isAutoApproved ? "#10B981" : "#F59E0B"}` }}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: decision content */}
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      isAutoApproved
                        ? "border-emerald-700/50 bg-emerald-900/60"
                        : "border-amber-700/50 bg-amber-900/40"
                    }`}
                  >
                    {isAutoApproved ? (
                      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${isAutoApproved ? "text-emerald-500" : "text-amber-500"}`}>
                      {isAutoApproved ? "Auto-approved" : "Requires review"}
                    </p>
                    <p className="text-base font-bold" style={{ color: "var(--text-main)" }}>{bestName} selected</p>
                    <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>You can proceed with this supplier</p>
                    <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
                      {isAutoApproved
                        ? "Auto-approved based on your priorities · All conditions are met"
                        : "Conflict detected — manual validation required"}
                    </p>
                  </div>
                </div>

                {/* Right: action buttons */}
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <button
                    onClick={handleApprove}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                      isAutoApproved
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-amber-600 hover:bg-amber-500"
                    }`}
                  >
                    Approve supplier
                  </button>
                  <button
                    onClick={handleReview}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-card)", color: "var(--text-main)" }}
                  >
                    Review details
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-card)" }}>
            <svg className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              No eligible supplier with current weight configuration.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
