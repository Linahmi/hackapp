"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProgressStepper       from "@/components/ProgressStepper";
import BundlingOpportunityCard, { BundlingOpportunity } from "@/components/BundlingOpportunityCard";
import AuditPDFExport        from "@/components/AuditPDFExport";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";
import MarketIntelCard, { SupplierIntelResult } from "@/components/MarketIntelCard";
import { SupplierComparisonTable, Supplier, ConflictWarning } from "@/components/agent/SupplierComparisonTable";
import { ArrowLeft } from "lucide-react";

type ConfidenceDriver = { tone: "good" | "warn" | "danger"; label: string };
type EscalationData = {
  blocking: boolean;
  escalate_to?: string;
  supplier_name?: string;
  trigger?: string;
};
type ShortlistSupplier = {
  supplier_id?: string;
  supplier_name: string;
  currency?: string;
  total_price?: number;
  tco?: number | null;
  risk_score?: number;
  esg_score?: number;
  preferred?: boolean;
  incumbent?: boolean;
  composite_score?: number;
  recommendation_note?: string;
  historical_flags?: string[];
  standard_lead_time_days?: number;
  score_breakdown?: {
    price?: number;
    risk?: number;
    lead_time?: number;
    esg?: number;
  };
};
type ExcludedSupplier = {
  supplier_id?: string;
  supplier_name: string;
  reason: string;
};
type RequestInterpretationData = {
  category_l1?: string | null;
  category_l2?: string | null;
  delivery_countries?: string[];
};
type RecommendationData = {
  status?: string;
  next_action?: string;
};
type AnalysisResult = {
  supplier_shortlist?: ShortlistSupplier[];
  confidence_score?: number;
  confidence_details?: ConfidenceDriver[];
  escalations?: EscalationData[];
  case_type?: string;
  recommendation?: RecommendationData | null;
  request_interpretation?: RequestInterpretationData;
  policy_evaluation?: { approval_threshold?: unknown };
  validation?: {
    completeness?: "pass" | "fail";
    issues?: {
      severity?: string;
      description: string;
      action_required?: string;
      type?: string;
      issue_id?: string;
    }[];
  };
  bundling_opportunity?: BundlingOpportunity | null;
  market_benchmark?: unknown;
  suppliers_excluded?: ExcludedSupplier[];
};

function riskLabel(score: number): "Low" | "Med" | "High" {
  if (score < 30) return "Low";
  if (score < 60) return "Med";
  return "High";
}

function esgLabel(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function formatAmount(amount?: number | null, currency = "EUR") {
  if (amount == null) return "N/A";
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  return `${Math.round(amount).toLocaleString("en")} ${currency}`;
}

function readStoredResult(): AnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    if (sessionStorage.getItem("procuretrace_session_active") !== "true") return null;
    const savedResult = sessionStorage.getItem("procuretrace_result");
    return savedResult ? JSON.parse(savedResult) as AnalysisResult : null;
  } catch {
    return null;
  }
}

const CASE_CONFIG: Record<string, { bg: string; border: string; iconColor: string; title: string; desc: string }> = {
  MORE_INFO_REQUIRED:    { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.3)",  iconColor: "#f59e0b", title: "More information required",          desc: "The request is too vague to process automatically. Please clarify the details below and resubmit." },
  FAILED_IMPOSSIBLE_DATE:{ bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.3)",   iconColor: "#dc2626", title: "Delivery date is not achievable",     desc: "The requested delivery window cannot be met by any available supplier. Please revise the deadline or accept an alternative timeline." },
  PENDING_RESOLUTION:   { bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.3)",   iconColor: "#dc2626", title: "Pending resolution",                 desc: "The request cannot proceed automatically. Resolve the blocking policy, budget, or approval issue below before continuing." },
  NO_SUPPLIER_AVAILABLE: { bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.3)",   iconColor: "#dc2626", title: "No compliant supplier found",          desc: "No supplier in the approved panel can fulfill this request with the given constraints. A sourcing specialist will need to intervene." },
  SIMILAR_NOT_EXACT_MATCH:{ bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.3)", iconColor: "#6366f1", title: "Similar alternatives found",            desc: "The exact product or configuration requested is not available. The suppliers below offer the closest compliant alternatives." },
  READY_FOR_VALIDATION:  { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.3)",   iconColor: "#22c55e", title: "Ready for validation",                 desc: "All compliance checks passed and suppliers are available. Review the recommendation below and validate to proceed." },
};

function SummaryCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" | "danger" }) {
  const toneClasses = {
    default: "border-gray-200 dark:border-white/10 bg-white dark:bg-[#12151f]",
    good: "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/8",
    warn: "border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/8",
    danger: "border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/8",
  };

  return (
    <div className={`rounded-xl border px-4 py-4 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{value}</p>
    </div>
  );
}

function ConflictBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-600">
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-base font-medium leading-relaxed text-amber-700">
          <span className="font-bold">Conflict detected:</span> {message}
        </p>
      </div>
    </div>
  );
}

function LiveSupplierShortlist({
  candidates,
}: {
  candidates: NonNullable<SupplierIntelResult["liveCandidates"]>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-3.5">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Updated Supplier Shortlist
        </span>
        <span className="text-xs font-medium text-gray-400">
          {candidates.length} live candidates via Exa
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {candidates.map((candidate, index) => (
          <div
            key={`${candidate.name}-${candidate.url || index}`}
            className={`px-6 py-5 ${index === 0 ? "bg-blue-50/40" : "bg-white"}`}
            style={index === 0 ? { borderLeft: "3px solid #2563eb" } : { borderLeft: "3px solid transparent" }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold leading-tight text-gray-900">{candidate.name}</span>
                  {index === 0 && (
                    <span className="inline-block rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 leading-none">
                      Live Rank #1
                    </span>
                  )}
                  <span className="inline-block rounded border border-blue-500/20 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 leading-none">
                    {candidate.source === "exa" ? `${candidate.sourceCount} live source${candidate.sourceCount === 1 ? "" : "s"}` : "dataset fallback"}
                  </span>
                </div>

                <div className="mb-3 flex items-baseline gap-1.5">
                  <span className="text-base font-bold text-gray-900">External candidate</span>
                  <span className="text-xs text-gray-400">· qualification required before award</span>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Live justification
                  </p>
                  <p className="text-xs leading-relaxed text-gray-600">
                    {candidate.reason}
                  </p>
                  {candidate.url && (
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Open live source
                    </a>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end justify-center pl-2">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Score
                </span>
                <div className={`text-3xl font-black tabular-nums leading-none ${index === 0 ? "text-blue-600" : "text-gray-600"}`}>
                  {candidate.score}
                  <span className="text-sm font-medium text-gray-400"> / 100</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-[10px] leading-relaxed text-gray-400">
        This shortlist is generated from live Exa web search and is meant for sourcing discovery. It does not override procurement policy or approved-supplier controls.
      </p>
    </div>
  );
}

function CaseBanner({ caseType, onValidate }: { caseType: string; onValidate?: () => void }) {
  const cfg = CASE_CONFIG[caseType];
  if (!cfg) return null;
  return (
    <div className="rounded-xl px-5 py-4 flex items-start gap-4" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
      <div className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.border }}>
        {caseType === "READY_FOR_VALIDATION" ? (
          <svg className="w-4 h-4" style={{ color: cfg.iconColor }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
        ) : caseType === "SIMILAR_NOT_EXACT_MATCH" ? (
          <svg className="w-4 h-4" style={{ color: cfg.iconColor }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
        ) : (
          <svg className="w-4 h-4" style={{ color: cfg.iconColor }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-main)" }}>{cfg.title}</p>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{cfg.desc}</p>
        {caseType === "READY_FOR_VALIDATION" && onValidate && (
          <button
            onClick={onValidate}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#22c55e" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            Validate Order
          </button>
        )}
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get("id");
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [marketIntel, setMarketIntel] = useState<SupplierIntelResult[]>([]);
  const [intelMode, setIntelMode] = useState<"shortlist" | "discovery">("shortlist");
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelFetched, setIntelFetched] = useState(false);
  const [intelError, setIntelError] = useState(false);
  const [validated, setValidated] = useState(false);
  const intelFetchStarted = useRef(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (idParam) {
        fetch(`/api/db/requests/${idParam}`)
          .then(res => res.json())
          .then(data => {
            setResult(data);
            setMounted(true);
          })
          .catch(err => {
            console.error("Failed to fetch from DB:", err);
            setResult(readStoredResult());
            setMounted(true);
          });
      } else {
        setResult(readStoredResult());
        setMounted(true);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [idParam]);

  useEffect(() => {
    if (mounted && !result) {
      router.push("/");
    }
  }, [mounted, result, router]);

  // Auto-trigger live supplier intel when result loads
  useEffect(() => {
    if (!result || intelFetchStarted.current) return;

    const shortlist = result.supplier_shortlist ?? [];
    const category = result.request_interpretation?.category_l2 ?? result.request_interpretation?.category_l1 ?? "enterprise hardware";
    const region = result.request_interpretation?.delivery_countries?.[0] ?? "Europe";

    if (!shortlist.length && result.case_type !== "NO_SUPPLIER_AVAILABLE") return;

    const discoveryMode = shortlist.length === 0;
    const controller = new AbortController();

    intelFetchStarted.current = true;

    const frameId = window.requestAnimationFrame(() => {
      setIntelLoading(true);

      fetch("/api/supplier-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          discoveryMode
            ? { category, region, discoveryMode: true }
            : { suppliers: shortlist.map((s) => s.supplier_name), category, region }
        ),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("intel fetch failed");
          return res.json() as Promise<{ results?: SupplierIntelResult[]; mode?: "shortlist" | "discovery" }>;
        })
        .then((data) => {
          setMarketIntel(data.results ?? []);
          setIntelMode(data.mode === "discovery" ? "discovery" : "shortlist");
          setIntelError(false);
        })
        .catch(() => {
          setIntelError(true);
        })
        .finally(() => {
          setIntelLoading(false);
          setIntelFetched(true);
        });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      controller.abort();
    };
  }, [result]);

  if (!mounted || !result) return null;

  const confidenceDetails = result.confidence_details ?? [];
  const blockingEscalations = (result.escalations ?? []).filter((e) => e.blocking);
  const hasBlockers = blockingEscalations.length > 0;
  const validationIssues = (result.validation as { issues?: { description: string }[] } | undefined)?.issues ?? [];

  // Override case type: never show READY_FOR_VALIDATION when blocking escalations exist
  const effectiveCaseType: string = (() => {
    if (hasBlockers && result.case_type === "READY_FOR_VALIDATION") return "PENDING_RESOLUTION";
    if (result.recommendation?.status === "cannot_proceed" && result.case_type === "READY_FOR_VALIDATION") return "PENDING_RESOLUTION";
    return result.case_type ?? "";
  })();

  const topSupplier = result.supplier_shortlist?.[0]?.supplier_name ?? "No compliant supplier found";
  const nextAction = result.recommendation?.next_action
    ?? (hasBlockers
      ? `Escalate to ${blockingEscalations[0]?.escalate_to ?? "Procurement"}`
      : "Validate and continue");
  const summaryTone =
    result.recommendation?.status === "cannot_proceed" || hasBlockers
      ? "danger"
      : "good";
  const comparisonSuppliers: Supplier[] = (result.supplier_shortlist ?? []).map((supplier, index) => ({
    supplier_id: supplier.supplier_id,
    name: supplier.supplier_name,
    price: formatAmount(supplier.total_price, supplier.currency ?? "EUR"),
    tco: formatAmount(supplier.tco, supplier.currency ?? "EUR"),
    totalPriceValue: supplier.total_price,
    tcoValue: supplier.tco ?? undefined,
    leadTimeDays: supplier.standard_lead_time_days,
    risk: riskLabel(supplier.risk_score ?? 50),
    esg: esgLabel(supplier.esg_score ?? 50),
    score: typeof supplier.composite_score === "number" ? Math.round(supplier.composite_score * 100) : null,
    badge: index === 0 ? "best" : "normal",
    recommendationNote: supplier.recommendation_note,
    historicalFlags: supplier.historical_flags,
    preferred: supplier.preferred,
    incumbent: supplier.incumbent,
    breakdown: [
      { label: "Price", value: Math.round((supplier.score_breakdown?.price ?? 0.5) * 100) },
      { label: "Risk", value: Math.round((supplier.score_breakdown?.risk ?? 0.5) * 100) },
      { label: "Delivery", value: Math.round((supplier.score_breakdown?.lead_time ?? 0.5) * 100) },
      { label: "ESG", value: Math.round((supplier.score_breakdown?.esg ?? 0.5) * 100) },
    ],
  }));
  const comparisonConflicts: ConflictWarning[] = blockingEscalations
    .filter((escalation) => escalation.trigger)
    .map((escalation) => ({ message: escalation.trigger! }));
  const liveCandidates = marketIntel.find((entry) => entry.liveCandidates?.length)?.liveCandidates ?? [];
  const inlineErrorMessage =
    blockingEscalations[0]?.trigger
    ?? validationIssues[0]?.description
    ?? null;

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-16 min-h-[calc(100vh-65px)] bg-gray-50 dark:bg-[#0f1117] transition-colors duration-300">
      <div className="w-full max-w-2xl pt-4 mb-4">
        <button
          onClick={() => {
            sessionStorage.clear();
            router.push("/");
          }}
          className="flex w-fit items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          style={{ textDecoration: 'none' }}
        >
          <ArrowLeft className="h-4 w-4" />
          New Request
        </button>
      </div>

      <div className="w-full max-w-2xl animate-fade-slide-up delay-0">
        <ProgressStepper
          activeStep={5}
          thinkingText=""
          pipelineStatus={
            result?.recommendation?.status === "cannot_proceed"
              ? "pending_resolution"
              : (result?.escalations ?? []).some((e) => e.blocking)
              ? "awaiting_action"
              : "complete"
          }
        />
      </div>

      {effectiveCaseType && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-100">
          <CaseBanner
            caseType={effectiveCaseType}
            onValidate={effectiveCaseType === "READY_FOR_VALIDATION" && !validated ? () => setValidated(true) : undefined}
          />
          {validated && (
            <div className="mt-3 rounded-lg px-4 py-3 text-sm font-semibold text-emerald-400 flex items-center gap-2" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              Order validated — sent to procurement for processing.
            </div>
          )}
        </div>
      )}

      {inlineErrorMessage && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-110">
          <ConflictBanner message={inlineErrorMessage} />
        </div>
      )}

      <div className="w-full max-w-2xl animate-fade-slide-up delay-125">
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard label="Case Status" value={CASE_CONFIG[effectiveCaseType]?.title ?? effectiveCaseType ?? "Analysis complete"} tone={summaryTone} />
          <SummaryCard label="Recommended Supplier" value={topSupplier} tone={result.recommendation?.status === "cannot_proceed" ? "warn" : "good"} />
          <SummaryCard label="Blocking Escalations" value={`${blockingEscalations.length}`} tone={blockingEscalations.length > 0 ? "danger" : "good"} />
          <SummaryCard label="Next Action" value={nextAction} tone={summaryTone} />
        </div>
        {typeof result.confidence_score === "number" && (
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12151f] px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Decision Confidence</p>
                <p className={`mt-1 text-2xl font-black ${result.confidence_score >= 78 ? "text-emerald-500" : result.confidence_score >= 55 ? "text-amber-500" : "text-red-500"}`}>
                  {result.confidence_score}%
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                Based on request completeness, policy clarity, shortlist strength, and escalation load.
              </p>
            </div>
            {confidenceDetails.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {confidenceDetails.map((item, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border ${
                      item.tone === "good"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                        : item.tone === "danger"
                        ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                        : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                    }`}
                  >
                    {item.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl animate-fade-slide-up delay-150">
        <RequestInterpretation interpretation={result.request_interpretation ? {
          ...result.request_interpretation,
          category_l1: result.request_interpretation.category_l1 ?? undefined,
          category_l2: result.request_interpretation.category_l2 ?? undefined,
        } : undefined} />
      </div>

      {effectiveCaseType === "READY_FOR_VALIDATION" && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-300">
          <PolicyCheck validation={result.validation ? {
            completeness: result.validation.completeness ?? "fail",
            issues: (result.validation.issues ?? []).map(i => ({
              issue_id: i.issue_id ?? i.type ?? "",
              severity: (i.severity as "critical" | "high" | "medium" | "low" | "warning") ?? "medium",
              type: i.type ?? "",
              description: i.description,
              action_required: i.action_required,
            })),
          } : undefined} />
        </div>
      )}

      {comparisonSuppliers.length > 0 && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-325">
          <SupplierComparisonTable
            suppliers={comparisonSuppliers}
            conflicts={comparisonConflicts}
          />
        </div>
      )}

      {liveCandidates.length > 0 && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-340">
          <LiveSupplierShortlist candidates={liveCandidates} />
        </div>
      )}

      {(effectiveCaseType === 'READY_FOR_VALIDATION' || effectiveCaseType === 'SIMILAR_NOT_EXACT_MATCH') && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-450">
          <BundlingOpportunityCard bundlingOpportunity={result.bundling_opportunity ?? null} />
        </div>
      )}

      <div className="w-full max-w-2xl animate-fade-slide-up delay-600">
        <AuditPDFExport data={result} />

        {(intelLoading || intelFetched) && !intelError && (
          <div className="w-full mt-8 animate-fade-slide-up delay-600">
            <MarketIntelCard results={marketIntel} loading={intelLoading} mode={intelMode} />
          </div>
        )}
        {intelFetched && intelError && (
          <div className="w-full mt-8 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-4 text-sm font-medium text-amber-700 dark:text-amber-400 animate-fade-slide-up">
            Live market intelligence unavailable — Exa.ai search could not be reached.
          </div>
        )}

      </div>
    </div>
  );
}
