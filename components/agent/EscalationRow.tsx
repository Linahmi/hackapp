"use client";

import { useState } from "react";

export type EscalationRowProps = {
  label: string;
  title: string;
  description: string;
  note: string;
};

export function EscalationRow({ label, title, description, note }: EscalationRowProps) {
  const [sent, setSent] = useState(false);

  function scrollToTable() {
    document.getElementById("supplier-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSend() {
    setSent(true);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1D27] shadow-sm mt-4 overflow-hidden">

      {/* Header row */}
      <div className="flex justify-between items-center px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-600/50 bg-orange-600/15 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            {label}
          </span>
        </div>

        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            Decision status
          </span>
          {sent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-600/40 bg-orange-900/25 px-3 py-0.5 text-xs font-medium text-orange-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Request sent
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-700/40 bg-orange-900/15 px-3 py-0.5 text-xs font-medium text-orange-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
              </span>
              Awaiting manager decision
            </span>
          )}
        </div>
      </div>

      {/* Decision body */}
      <div className="px-5 py-5">
        {sent ? (
          <div
            className="rounded-lg border border-orange-700/40 px-5 py-4"
            style={{
              borderLeft: "3px solid #F97316",
              background: "linear-gradient(to right, rgba(124,45,18,0.15), transparent)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-700/50 bg-orange-900/50"
                style={{ boxShadow: "0 0 10px rgba(249,115,22,0.25)" }}
              >
                <svg className="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Request sent for approval</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Escalated to manager · awaiting decision
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg border border-orange-700/30 px-5 py-4 transition-all duration-300"
            style={{
              borderLeft: "3px solid #F97316",
              background: "linear-gradient(to right, rgba(124,45,18,0.12), transparent)",
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-orange-700/50 bg-orange-900/50"
                  style={{ boxShadow: "0 0 14px rgba(249,115,22,0.3)" }}
                >
                  <svg className="h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-orange-500">
                    Manual review needed
                  </p>
                  <p className="text-base font-bold text-white">{title}</p>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{description}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded border border-orange-700/40 bg-orange-900/25 px-2 py-0.5 text-xs font-semibold text-orange-300">
                      Estimated savings: 18k CHF
                    </span>
                    <span className="text-xs text-gray-600">{note}</span>
                  </div>

                  <button
                    onClick={scrollToTable}
                    className="mt-2 text-xs text-orange-500/70 hover:text-orange-400 transition-colors duration-150 underline underline-offset-2"
                  >
                    See rationale
                  </button>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleSend}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-orange-500 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Request manager approval
                </button>
                <button
                  onClick={scrollToTable}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-300 transition-all duration-150 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]"
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
