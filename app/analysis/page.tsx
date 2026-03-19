"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressStepper       from "@/components/ProgressStepper";
import BundlingOpportunityCard from "@/components/BundlingOpportunityCard";
import AuditPDFExport        from "@/components/AuditPDFExport";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";
import MarketIntelCard, { SupplierIntelResult } from "@/components/MarketIntelCard";
import { ArrowLeft } from "lucide-react";

const CASE_CONFIG: Record<string, { bg: string; border: string; iconColor: string; title: string; desc: string }> = {
  MORE_INFO_REQUIRED:    { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.3)",  iconColor: "#f59e0b", title: "More information required",          desc: "The request is too vague to process automatically. Please clarify the details below and resubmit." },
  FAILED_IMPOSSIBLE_DATE:{ bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.3)",   iconColor: "#dc2626", title: "Delivery date is not achievable",     desc: "The requested delivery window cannot be met by any available supplier. Please revise the deadline or accept an alternative timeline." },
  NO_SUPPLIER_AVAILABLE: { bg: "rgba(220,38,38,0.06)", border: "rgba(220,38,38,0.3)",   iconColor: "#dc2626", title: "No compliant supplier found",          desc: "No supplier in the approved panel can fulfill this request with the given constraints. A sourcing specialist will need to intervene." },
  SIMILAR_NOT_EXACT_MATCH:{ bg: "rgba(99,102,241,0.06)", border: "rgba(99,102,241,0.3)", iconColor: "#6366f1", title: "Similar alternatives found",            desc: "The exact product or configuration requested is not available. The suppliers below offer the closest compliant alternatives." },
  READY_FOR_VALIDATION:  { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.3)",   iconColor: "#22c55e", title: "Ready for validation",                 desc: "All compliance checks passed and suppliers are available. Review the recommendation below and validate to proceed." },
};

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
  const [result, setResult] = useState<any>(null);
  const [marketIntel, setMarketIntel] = useState<SupplierIntelResult[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelFetched, setIntelFetched] = useState(false);
  const [intelError, setIntelError] = useState(false);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("procuretrace_session_active") === "true") {
        const savedResult = sessionStorage.getItem("procuretrace_result");
        if (savedResult) {
          setResult(JSON.parse(savedResult));
        } else {
          router.push("/");
        }
      } else {
        router.push("/");
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  // Auto-trigger live supplier intel when result loads
  useEffect(() => {
    if (!result?.supplier_shortlist?.length || intelFetched || intelLoading) return;
    setIntelLoading(true);
    const names = result.supplier_shortlist.map((s: any) => s.supplier_name);
    const category = result.request_interpretation?.category_l2 ?? result.request_interpretation?.category_l1 ?? "enterprise hardware";
    const region = result.request_interpretation?.delivery_countries?.[0] ?? "Europe";
    fetch("/api/supplier-intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suppliers: names, category, region }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setMarketIntel(data.results ?? []))
      .catch(() => setIntelError(true))
      .finally(() => { setIntelLoading(false); setIntelFetched(true); });
  }, [result]);

  if (!result) return null;

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
              : (result?.escalations ?? []).some((e: any) => e.blocking)
              ? "awaiting_action"
              : "complete"
          }
        />
      </div>

      {result.case_type && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-100">
          <CaseBanner
            caseType={result.case_type}
            onValidate={result.case_type === "READY_FOR_VALIDATION" && !validated ? () => setValidated(true) : undefined}
          />
          {validated && (
            <div className="mt-3 rounded-lg px-4 py-3 text-sm font-semibold text-emerald-400 flex items-center gap-2" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              Order validated — sent to procurement for processing.
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-2xl animate-fade-slide-up delay-150">
        <RequestInterpretation interpretation={result.request_interpretation} />
      </div>

      {result.case_type === "READY_FOR_VALIDATION" && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-300">
          <PolicyCheck validation={result.validation} />
        </div>
      )}

      {(result?.recommendation?.decision_summary || result?.recommendation?.rationale) && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-350">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#12151f] px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
              </span>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Decision Justification</h3>
            </div>
            {result.recommendation.decision_summary ? (
              <div className="flex flex-col gap-4">
                <div className={`rounded-lg px-4 py-3 ${result.recommendation.status === 'cannot_proceed' ? 'bg-red-50 dark:bg-red-500/8 border border-red-200 dark:border-red-500/20' : 'bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-200 dark:border-emerald-500/20'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${result.recommendation.status === 'cannot_proceed' ? 'text-red-500' : 'text-emerald-500'}`}>Decision</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{result.recommendation.decision_summary}</p>
                </div>
                {result.recommendation.justification && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5 text-gray-400">Justification</p>
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{result.recommendation.justification}</p>
                  </div>
                )}
                {result.recommendation.next_action && (
                  <div className="rounded-lg px-4 py-3 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 text-amber-500">Next Action</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{result.recommendation.next_action}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 font-medium">{result.recommendation.rationale}</p>
            )}
          </div>
        </div>
      )}

      {(result.case_type === 'READY_FOR_VALIDATION' || result.case_type === 'SIMILAR_NOT_EXACT_MATCH') && (
        <div className="w-full max-w-2xl animate-fade-slide-up delay-450">
          <BundlingOpportunityCard bundlingOpportunity={result.bundling_opportunity ?? null} />
        </div>
      )}

      <div className="w-full max-w-2xl animate-fade-slide-up delay-600">
        <AuditPDFExport data={result} />

        {(intelLoading || intelFetched) && !intelError && (
          <div className="w-full mt-8 animate-fade-slide-up delay-600">
            <MarketIntelCard results={marketIntel} loading={intelLoading} />
          </div>
        )}
        {intelFetched && intelError && (
          <div className="w-full mt-8 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-4 text-sm font-medium text-amber-700 dark:text-amber-400 animate-fade-slide-up">
            Live market intelligence unavailable — Exa.ai search could not be reached.
          </div>
        )}

        <button
          onClick={() => router.push("/supplier")}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl px-6 py-4 mt-8 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          style={{ backgroundColor: "#dc2626" }}
        >
          View Supplier Analysis
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
