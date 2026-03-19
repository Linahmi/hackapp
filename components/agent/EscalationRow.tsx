"use client";

import { useState } from "react";

export type EscalationRowProps = {
  label: string;
  title: string;
  description: string;
  note: string;
  estimatedSavings?: string | null;
  approver?: string;
};

export function EscalationRow({ label, title, description, note, estimatedSavings, approver = "Manager" }: EscalationRowProps) {
  const [sent, setSent] = useState(false);

  function scrollToTable() {
    document.getElementById("supplier-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSend() {
    setSent(true);
  }

  return (
    <div className="rounded-2xl shadow-sm mt-8 overflow-hidden bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] transition-colors duration-300">
      {/* Header row */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            {label}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Decision status
          </span>
          {sent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-50 dark:bg-orange-900/25 px-3 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
              Request sent
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-50 dark:bg-orange-900/15 px-3 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
              </span>
              Awaiting {approver} decision
            </span>
          )}
        </div>
      </div>

      {/* Decision body */}
      <div className="px-6 py-6">
        {sent ? (
          <div className="rounded-xl border-l-4 border-orange-500 bg-orange-50 dark:bg-[#1a130f] border-r border-t border-b border-orange-200 dark:border-orange-500/20 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-300 dark:border-orange-500/50 bg-orange-200 dark:bg-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)] dark:shadow-[0_0_15px_rgba(249,115,22,0.25)]">
                <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-base font-bold text-gray-900 dark:text-white">Request sent for approval</p>
                <p className="text-sm mt-0.5 font-medium text-gray-600 dark:text-gray-400">
                   Escalated to {approver} · awaiting decision
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-white dark:from-[#1a130f] dark:to-transparent border-r border-t border-b border-orange-200 dark:border-orange-500/20 px-6 py-5 transition-all duration-300 hover:shadow-md">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
              <div className="flex items-start gap-4 min-w-0">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-300 dark:border-orange-500/50 bg-orange-200 dark:bg-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.2)] dark:shadow-[0_0_15px_rgba(249,115,22,0.3)] text-orange-600 dark:text-orange-400">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1 text-orange-600 dark:text-orange-500">
                    Manual review needed
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{title}</p>
                  <p className="text-sm font-medium mt-1 leading-relaxed text-gray-600 dark:text-gray-400">{description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {estimatedSavings && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 dark:border-orange-700/40 bg-orange-100 dark:bg-orange-900/25 px-3 py-1 text-xs font-bold text-orange-700 dark:text-orange-300">
                        Estimated savings: {estimatedSavings}
                      </span>
                    )}
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{note}</span>
                  </div>

                  <button
                    onClick={scrollToTable}
                    className="mt-3 text-xs font-bold text-orange-600 dark:text-orange-500/70 hover:text-orange-500 dark:hover:text-orange-400 transition-colors duration-150 underline underline-offset-4"
                  >
                    See rationale
                  </button>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSend}
                  className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-orange-500 shadow-sm"
                >
                  Request {approver} approval
                </button>
                <button
                  onClick={scrollToTable}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm"
                >
                  Review details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
