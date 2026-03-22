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
  justification?: string;
  rationale?: string;
  key_reasons?: string[];
  risks?: string[];
  next_action?: string;
};

type TopSupplierSnapshot = {
  score: number;
  unitPrice: number | null;
  leadTime: number | null;
  currency: string;
};

export type DecisionRowProps = {
  bestName: string;
  bestScore: number | null;
  isAutoApproved: boolean;
  status?: string;
  escalations?: Escalation[];
  recommendation?: RecommendationData;
  requestId?: string;
  topSupplier?: TopSupplierSnapshot;
  confidenceScore?: number | null;
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
  topSupplier,
  onClose,
}: {
  requestId?: string;
  bestName: string;
  status: string;
  isAutoApproved: boolean;
  escalations: Escalation[];
  recommendation?: RecommendationData;
  topSupplier?: TopSupplierSnapshot;
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

  const blockingEscalations    = escalations.filter(e => e.blocking);
  const advisoryEscalations    = escalations.filter(e => !e.blocking);
  const decisionSummary        = recommendation?.decision_summary;
  const justification          = recommendation?.justification;
  const risks                  = recommendation?.risks ?? [];

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
          className="review-modal-print-shell relative w-full max-w-[720px] max-h-[88vh] flex flex-col bg-white dark:bg-[#12151f] rounded-2xl border border-gray-200 dark:border-[#1e2130] shadow-2xl overflow-hidden"
          style={{ maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 px-7 py-5 border-b border-gray-100 dark:border-white/5 shrink-0">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
                ChainIQ — Request Review
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
                {bestName && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    · {bestName}
                  </span>
                )}
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

            {/* Section 1 — Blocking escalations */}
            {blockingEscalations.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Blocking issues</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">These must be resolved before sourcing can proceed.</p>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <div className="space-y-3">
                  {blockingEscalations.map((e, i) => (
                    <div key={i} className="rounded-xl border-l-4 border-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">{e.rule}</p>
                        {e.escalate_to && (
                          <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50 rounded-full px-2 py-0.5">
                            → {e.escalate_to}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-snug text-red-800 dark:text-red-200">{e.trigger}</p>
                      {e.action && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium border-t border-red-200 dark:border-red-800/40 pt-2">
                          Required action: {e.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2 — Advisory escalations */}
            {advisoryEscalations.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Advisory notices</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Non-blocking — flagged for awareness but do not prevent approval.</p>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <div className="space-y-2">
                  {advisoryEscalations.map((e, i) => (
                    <div key={i} className="rounded-xl border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 px-4 py-3">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">{e.rule}</p>
                        {e.escalate_to && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40 rounded-full px-2 py-0.5">
                            → {e.escalate_to}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-snug text-amber-800 dark:text-amber-200">{e.trigger}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3 — Top supplier snapshot */}
            {topSupplier && topSupplier.score > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Recommended supplier</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Key metrics for <span className="font-semibold text-gray-700 dark:text-gray-300">{bestName}</span> — ranked first by composite score.</p>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[120px] rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Composite Score</p>
                    <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{topSupplier.score}<span className="text-sm font-semibold text-gray-400">/100</span></p>
                  </div>
                  {topSupplier.unitPrice != null && (
                    <div className="flex-1 min-w-[120px] rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Total Price</p>
                      <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                        {topSupplier.unitPrice.toLocaleString()}
                        <span className="text-sm font-semibold text-gray-400 ml-1">{topSupplier.currency}</span>
                      </p>
                    </div>
                  )}
                  {topSupplier.leadTime != null && (
                    <div className="flex-1 min-w-[120px] rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-4 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Lead Time</p>
                      <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">{topSupplier.leadTime}<span className="text-sm font-semibold text-gray-400 ml-1">days</span></p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4 — Decision justification */}
            {justification && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Decision justification</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">AI-generated rationale based on supplier data, policy checks, and request constraints.</p>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{justification}</p>
              </div>
            )}

            {/* Section 5 — Key reasoning */}
            {reasoningBullets.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">How the AI reasoned through this</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Step-by-step factors considered during evaluation.</p>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <ul className="space-y-3">
                  {reasoningBullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0" />
                      <p className="text-sm leading-snug text-gray-700 dark:text-gray-300">{bullet}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section 6 — Risk factors */}
            {risks.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Risk factors to monitor</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Identified risks that should be tracked after award.</p>
                <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
                <ul className="space-y-2">
                  {risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 px-4 py-2.5">
                      <span className="mt-0.5 text-amber-500 shrink-0">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </span>
                      <p className="text-sm leading-snug text-amber-800 dark:text-amber-200">{risk}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Section 7 — Next actions */}
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">What needs to happen next</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Ordered steps required to move this request forward.</p>
              <div className="h-px bg-gray-100 dark:bg-white/5 mb-4" />
              <ul className="space-y-3">
                {nextActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-snug text-gray-700 dark:text-gray-300">{action}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 8 — Decision summary box */}
            {decisionSummary && (
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] px-5 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Decision summary</p>
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
  isAutoApproved,
  status = "pending_approval",
  escalations = [],
  recommendation,
  requestId,
  topSupplier,
  confidenceScore,
}: DecisionRowProps) {
  const [approvedSupplier, setApprovedSupplier] = useState<string | null>(null);
  const [showModal,  setShowModal]  = useState(false);

  const hasEligible = bestName !== "" && bestScore !== null;
  const approved = approvedSupplier === bestName;

  function handleApprove() {
    setApprovedSupplier(bestName);
  }

  return (
    <>
      <div className="rounded-2xl shadow-sm mt-8 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] transition-colors duration-300">
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
                      {confidenceScore !== null && (
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mt-1">
                          Confidence: {confidenceScore}/100
                        </p>
                      )}
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
                      onClick={() => setShowModal(true)}
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
          topSupplier={topSupplier}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
