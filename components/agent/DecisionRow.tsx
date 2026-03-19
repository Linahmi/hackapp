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
    <div className="rounded-2xl shadow-sm mt-8 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] transition-colors duration-300">
      {/* Header row */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
            Urgent procurement request
          </span>
        </div>

        {/* Decision status indicator — non-interactive */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
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
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400">
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
            <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-700/30 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200 dark:border-emerald-700/50 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900 dark:text-white">Supplier approved</p>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-0.5">Workflow started successfully · {bestName}</p>
                </div>
              </div>
            </div>
          ) : status === "cannot_proceed" ? (
            /* ── Cannot Proceed state ── */
            <div className="rounded-xl border-l-4 border-red-500 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-700/30 px-6 py-5">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-red-200 dark:border-red-700/50 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500">
                    <span className="font-black mb-0.5 text-xl">✗</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1 text-red-600 dark:text-red-500">
                      Cannot proceed
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">Blocking Issues Detected</p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1 mb-3">Manual intervention required before sourcing can proceed</p>
                    {escalations && escalations.length > 0 && (
                      <div className="flex flex-col gap-2 mt-3">
                        {escalations.filter(e => e.blocking).map((e, i) => (
                          <div key={i} className="text-sm rounded-lg bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-3 text-red-800 dark:text-red-200">
                            <span className="font-bold text-red-700 dark:text-red-400">{e.rule}:</span> {e.trigger}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <button
                    onClick={handleReview}
                    className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm"
                  >
                    Review details
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Default decision card ── */
            <div className={`rounded-xl border-l-4 px-6 py-5 ${
                isAutoApproved
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-700/30"
                  : "border-amber-500 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/30"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
                {/* Left: decision content */}
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                      isAutoApproved
                        ? "border-emerald-200 dark:border-emerald-700/50 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-200 dark:border-amber-700/50 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {isAutoApproved ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isAutoApproved ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600 dark:text-amber-500"}`}>
                      {isAutoApproved ? "Auto-approved" : "Requires review"}
                    </p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{bestName} selected</p>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">You can proceed with this supplier</p>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mt-2">
                      {isAutoApproved
                        ? "Auto-approved based on your priorities · All conditions are met"
                        : "Conflict detected — manual validation required"}
                    </p>
                  </div>
                </div>

                {/* Right: action buttons */}
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleApprove}
                    className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all shadow-sm ${
                      isAutoApproved
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-amber-600 hover:bg-amber-500"
                    }`}
                  >
                    Approve supplier
                  </button>
                  <button
                    onClick={handleReview}
                    className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm"
                  >
                    Review details
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-5 py-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
            <svg className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              No eligible supplier with current weight configuration.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
