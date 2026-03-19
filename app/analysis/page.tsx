"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProgressStepper       from "@/components/ProgressStepper";
import BundlingOpportunityCard from "@/components/BundlingOpportunityCard";
import AuditPDFExport        from "@/components/AuditPDFExport";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";
import { ArrowLeft } from "lucide-react";

export default function AnalysisPage() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);

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
          ← New Request
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
