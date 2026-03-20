"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Escalation = {
  escalation_id?: string;
  rule: string;
  trigger: string;
  escalate_to?: string;
  hierarchy_level?: number;
  hierarchy_label?: string;
  blocking: boolean;
  action?: string;
  estimated_savings?: number | null;
};

type RecommendationData = {
  decision_summary?: string;
  rationale?: string;
  key_reasons?: string[];
  risks?: string[];
  next_action?: string;
};

export type DecisionRowProps = {
  bestName: string;
  bestScore: number | null;
  bestPrice: string;
  isAutoApproved: boolean;
  status?: string;
  escalations?: Escalation[];
  recommendation?: RecommendationData;
  requestId?: string;
};

// ─── Modal content helpers ────────────────────────────────────────────────────

function buildReasoningBullets(
  bestName: string,
  status: string,
  isAutoApproved: boolean,
  escalations: Escalation[],
  recommendation?: RecommendationData
): string[] {
  const bullets: string[] = [];

  if (recommendation?.key_reasons?.length) {
    recommendation.key_reasons.forEach(r => bullets.push(r));
  } else {
    if (bestName) {
      bullets.push(
        `The AI evaluated all available suppliers and identified ${bestName} as the leading compliant candidate based on current procurement priorities.`
      );
    }
    if (recommendation?.rationale) {
      bullets.push(recommendation.rationale);
    }
    if (recommendation?.decision_summary) {
      bullets.push(recommendation.decision_summary);
    }
    const blocking = escalations.filter(e => e.blocking);
    blocking.forEach(e => {
      bullets.push(`Policy check failed — ${e.rule}: ${e.trigger}`);
    });
    if (!blocking.length && !recommendation?.rationale) {
      bullets.push("All policy rules were evaluated against the submitted request and supplier shortlist.");
      bullets.push(
        status === "cannot_proceed"
          ? "A blocking compliance or routing condition prevents the request from progressing automatically."
          : isAutoApproved
          ? "The request can proceed automatically because the recommendation satisfies the current approval conditions."
          : "The recommendation is viable, but a human reviewer still needs to validate the decision before it proceeds."
      );
    }
  }

  return bullets.filter(Boolean).slice(0, 6);
}

function buildNextActions(
  status: string,
  isAutoApproved: boolean,
  escalations: Escalation[],
  recommendation?: RecommendationData
): string[] {
  const actions: string[] = [];

  if (recommendation?.next_action) {
    actions.push(recommendation.next_action);
  }

  escalations
    .filter(e => e.blocking && e.action)
    .forEach(e => {
      const who = e.hierarchy_label ?? e.escalate_to ?? "Responsible team";
      actions.push(`${who}: ${e.action}`);
    });

  if (actions.length === 0) {
    if (status === "cannot_proceed") {
      actions.push("Review the blocking issues listed above with your procurement manager.");
      actions.push("Resolve each policy violation before resubmitting the request for approval.");
    } else if (isAutoApproved) {
      actions.push("Proceed with the recommended supplier and capture the decision in the audit trail.");
      actions.push("Use the export or audit functions if a record of the automated decision is needed.");
    } else {
      actions.push("Review the recommended supplier and supporting rationale with the responsible approver.");
      actions.push("Approve the request or escalate if additional policy concerns remain unresolved.");
    }
  }

  return actions.slice(0, 4);
}

// ─── Review Details Modal ─────────────────────────────────────────────────────

function ReviewDetailsModal({
  requestId,
  bestName,
  status,
  isAutoApproved,
  escalations,
  recommendation,
  onClose,
}: {
  requestId?: string;
  bestName: string;
  status: string;
  isAutoApproved: boolean;
  escalations: Escalation[];
  recommendation?: RecommendationData;
  onClose: () => void;
}) {
  const reasoningBullets = buildReasoningBullets(bestName, status, isAutoApproved, escalations, recommendation);
  const nextActions      = buildNextActions(status, isAutoApproved, escalations, recommendation);
  const modalTone =
    status === "cannot_proceed"
      ? {
          label: "Cannot Proceed",
          classes: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
          dot: "bg-red-500",
        }
      : isAutoApproved
      ? {
          label: "Auto-Approved",
          classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          dot: "bg-emerald-500",
        }
      : {
          label: "Requires Review",
          classes: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
          dot: "bg-amber-500",
        };

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const blockingEscalations = escalations.filter(e => e.blocking);
  const decisionSummary = recommendation?.decision_summary;

  const modal = (
    <>
      {/* Print-only CSS: hides everything except modal content */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          .review-modal-print-shell,
          .review-modal-print-shell * { visibility: visible !important; }
          .review-modal-print-shell {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .review-modal-print-body {
            overflow: visible !important;
            max-height: none !important;
            padding: 1.5rem 2.5rem 2rem !important;
          }
          .review-modal-print-shell .line-clamp-2 {
            overflow: visible !important;
            display: block !important;
            -webkit-line-clamp: unset !important;
            -webkit-box-orient: unset !important;
          }
          .review-modal-no-print { display: none !important; }
        }
      `}</style>

      {/* Overlay — rendered via portal so fixed positioning is always relative to the viewport */}
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-label="Request review details"
      >
        {/* Card — stop click propagation so clicks inside don't close the modal */}
        <div
          className="review-modal-print-shell relative w-full max-w-[680px] max-h-[88vh] flex flex-col bg-white dark:bg-[#12151f] rounded-2xl border border-gray-200 dark:border-[#1e2130] shadow-2xl overflow-hidden"
          style={{ maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 px-7 py-5 border-b border-gray-100 dark:border-white/5 shrink-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
                ProcureTrace — Request Review
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {requestId && (
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded px-1.5 py-0.5">
                    {requestId}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${modalTone.classes}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${modalTone.dot}`} />
                  {modalTone.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="review-modal-no-print shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="review-modal-print-body flex-1 overflow-y-auto px-7 py-6 space-y-8">

            {/* Section 1 — Why this cannot proceed (blocking escalations) */}
            {blockingEscalations.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                  Why this cannot proceed
                </h2>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <div className="space-y-2">
                  {blockingEscalations.map((e, i) => (
                    <div key={i} className="rounded-lg border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400 mb-0.5">{e.rule}</p>
                      <p className="text-sm leading-snug text-red-800 dark:text-red-200">{e.trigger}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2 — AI reasoning */}
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                How the AI reasoned through this
              </h2>
              <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
              <ul className="space-y-3">
                {reasoningBullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 shrink-0" />
                    <p className="text-base leading-snug text-gray-700 dark:text-gray-300">
                      {bullet}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 3 — Next actions */}
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                What needs to happen next
              </h2>
              <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
              <ul className="space-y-3">
                {nextActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      {i + 1}
                    </span>
                    <p className="text-base leading-snug text-gray-700 dark:text-gray-300">
                      {action}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 4 — DECISION summary box */}
            {decisionSummary && (
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Decision</p>
                <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{decisionSummary}</p>
              </div>
            )}

          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-4 px-7 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] shrink-0">
            <button
              onClick={() => window.print()}
              className="review-modal-no-print inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Export as PDF
            </button>
            <button
              onClick={onClose}
              className="review-modal-no-print rounded-xl px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DecisionRow({
  bestName,
  bestScore,
  bestPrice,
  isAutoApproved,
  status = "pending_approval",
  escalations = [],
  recommendation,
  requestId,
}: DecisionRowProps) {
  const [approved,   setApproved]   = useState(false);
  const [showModal,  setShowModal]  = useState(false);

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
    <>
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
                      {escalations.length > 0 && (
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
                      onClick={() => setShowModal(true)}
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

      {/* Review Details Modal */}
      {showModal && (
        <ReviewDetailsModal
          requestId={requestId}
          bestName={bestName}
          status={status}
          isAutoApproved={isAutoApproved}
          escalations={escalations}
          recommendation={recommendation}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
