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

export default function AnalysisPage() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [marketIntel, setMarketIntel] = useState<SupplierIntelResult[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelFetched, setIntelFetched] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("session_active") === "true") {
        const savedResult = sessionStorage.getItem("procure_result");
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
          done={true}
          pct={100}
        />
      </div>

      <div className="w-full max-w-2xl animate-fade-slide-up delay-150">
        <RequestInterpretation interpretation={result.request_interpretation} />
      </div>

      <div className="w-full max-w-2xl animate-fade-slide-up delay-300">
        <PolicyCheck validation={result.validation} />
      </div>

      <div className="w-full max-w-2xl animate-fade-slide-up delay-450">
        <BundlingOpportunityCard bundlingOpportunity={result.bundling_opportunity ?? null} />
      </div>

      <div className="w-full max-w-2xl animate-fade-slide-up delay-600">
        <AuditPDFExport data={result} />

        <div className="w-full mt-8 animate-fade-slide-up delay-600">
          {!intelFetched && !intelLoading && result?.supplier_shortlist?.length > 0 && (
            <button
              onClick={async () => {
                setIntelLoading(true);
                try {
                  const names = result.supplier_shortlist.map((s: any) => s.supplier_name);
                  const category = result.request_interpretation?.category_l2 ?? result.request_interpretation?.category_l1 ?? "enterprise hardware";
                  const region = result.request_interpretation?.delivery_countries?.[0] ?? "Europe";
                  const res = await fetch("/api/supplier-intel", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ suppliers: names, category, region }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setMarketIntel(data.results ?? []);
                  }
                } catch (err) {
                  console.error("Market intel fetch failed:", err);
                } finally {
                  setIntelLoading(false);
                  setIntelFetched(true);
                }
              }}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-6 py-4 text-sm font-bold text-blue-600 dark:text-blue-400 transition-all hover:bg-blue-100 dark:hover:bg-blue-500/15 hover:scale-[1.01] hover:shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Search Live Market Intelligence
            </button>
          )}
          {(intelLoading || intelFetched) && (
            <div className="mb-0">
              <MarketIntelCard results={marketIntel} loading={intelLoading} />
            </div>
          )}
        </div>

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
