"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RequestInput          from "@/components/RequestInput";
import ProgressStepper       from "@/components/ProgressStepper";
import BundlingOpportunityCard from "@/components/BundlingOpportunityCard";
import AuditPDFExport        from "@/components/AuditPDFExport";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";

type Stage = "idle" | "intake" | "processing" | "done" | "error";

export default function Home() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [activeReqId, setActiveReqId] = useState("REQ-000004");
  const [stage,  setStage]  = useState<Stage>("idle");
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  function handleTextChange(val: string) {
    setText(val);
    localStorage.setItem("buyer_request", val);
  }

  useEffect(() => {
    const saved = localStorage.getItem("buyer_request");
    if (saved) setText(saved);
  }, []);

  useEffect(() => {
    const handleDemo = (e: any) => {
      if (e.detail) {
        handleTextChange("Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF, prefer Dell");
      } else {
        handleTextChange("");
      }
    };
    window.addEventListener("toggleDemo", handleDemo);
    return () => window.removeEventListener("toggleDemo", handleDemo);
  }, []);

  async function handleLoadExample() {
    try {
      const res = await fetch("/api/demo");
      if (!res.ok) return;
      const demos = await res.json();
      if (demos?.[0]?.request_text) handleTextChange(demos[0].request_text);
    } catch {
      // silently ignore — demo endpoint unavailable
    }
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    setError(null);
    setResult(null);

    try {
      setStage("intake");
      await new Promise(r => setTimeout(r, 800));

      setStage("processing");
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, request_id: activeReqId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");

      await new Promise(r => setTimeout(r, 800));

      setResult(data);
      sessionStorage.setItem("procure_result", JSON.stringify(data));
      setStage("done");
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setStage("error");
    }
  }

  const isLoading = stage === "intake" || stage === "processing";

  return (
    <div
      className="flex flex-col items-center gap-8 px-4 py-16"
      style={{ backgroundColor: "var(--bg-app)", minHeight: "calc(100vh - 49px)" }}
    >
      <RequestInput
        value={text}
        onChange={handleTextChange}
        onSubmit={handleSubmit}
        onLoadExample={handleLoadExample}
        disabled={isLoading}
      />

      {/* Dynamic Demo Toggle Buttons */}
      <div className="flex gap-4 w-full max-w-2xl px-2 no-print">
        <button 
          onClick={() => {
            handleTextChange("Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25 199.55 EUR. Please use Dell Enterprise Europe with no exception.");
            setActiveReqId("REQ-000004");
          }}
          className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${activeReqId === "REQ-000004" ? "bg-white/20 text-white border-white/20" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
        >
          Load Edge Case (REQ-000004)
        </button>
        <button 
          onClick={() => {
            handleTextChange("Need 500 laptops for fleet refresh  onboarding  and warranty replacement. Delivery required by 2026-04-06. Budget is approximately 490 000.00 EUR.");
            setActiveReqId("REQ-000038");
          }}
          className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${activeReqId === "REQ-000038" ? "bg-white/20 text-white border-white/20" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
        >
          Load Standard Demo (REQ-000038)
        </button>
        <button 
          onClick={() => {
            // Use the full text for REQ-000001 so the agent doesn't have to guess
            handleTextChange("Need 400 consulting days of IT project management support starting next month. Delivery required by 2026-05-17. Budget is approximately 400 000.00 EUR. Prefer Accenture Advisory Europe if commercially competitive.");
            setActiveReqId("REQ-000001");
          }}
          className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${activeReqId === "REQ-000001" ? "bg-white/20 text-white border-white/20" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
        >
          Load IT Project (REQ-000001)
        </button>
        <button 
          onClick={() => {
            handleTextChange("Need 5 content production projects for employer branding and product campaigns. Please move quickly. We would like to stay with WPP Performance Media if possible.");
            setActiveReqId("REQ-000012");
          }}
          className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${activeReqId === "REQ-000012" ? "bg-white/20 text-white border-white/20" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
        >
          Load Missing Info (REQ-000012)
        </button>
      </div>

      {/* Progress stepper — visible while loading or done */}
      {stage !== "idle" && stage !== "error" && (
        <ProgressStepper stage={stage === "done" ? "done" : stage} />
      )}

      {/* Error */}
      {stage === "error" && error && (
        <div
          className="w-full max-w-2xl rounded-xl px-5 py-4 text-sm flex items-start justify-between gap-4"
          style={{
            backgroundColor: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.3)",
            color: "#fca5a5",
          }}
        >
          <span><span className="font-semibold">Error: </span>{error}</span>
          <button
            onClick={() => { setStage("idle"); setError(null); }}
            className="shrink-0 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results — interpretation + policy check + CTA */}
      {stage === "done" && result && (
        <>
          <RequestInterpretation interpretation={result.request_interpretation} />
          <PolicyCheck           validation={result.validation} />

          <BundlingOpportunityCard bundlingOpportunity={result.bundling_opportunity ?? null} />

          <AuditPDFExport data={result} />

          {/* Navigation CTA to Page 2 */}
          <div className="w-full max-w-2xl">
            <button
              onClick={() => router.push("/supplier")}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#C8102E" }}
            >
              View Supplier Analysis
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-pulse mt-4">
          <div className="h-[120px] rounded-xl w-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }} />
          <div className="h-[80px] rounded-xl w-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }} />
        </div>
      )}
    </div>
  );
}
