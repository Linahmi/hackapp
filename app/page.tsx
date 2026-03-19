"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RequestInput          from "@/components/RequestInput";
import ProgressStepper       from "@/components/ProgressStepper";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";

type Stage = "idle" | "intake" | "processing" | "done" | "error";

export default function Home() {
  const router = useRouter();
  const [text,   setText]   = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("buyer_request") ?? "";
    return "";
  });
  const [activeReqId, setActiveReqId] = useState("REQ-000004");
  const [stage,  setStage]  = useState<Stage>("idle");
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  function handleTextChange(val: string) {
    setText(val);
    localStorage.setItem("buyer_request", val);
  }

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
      router.push("/supplier");
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
      <div className="flex gap-4 w-full max-w-2xl px-2">
        <button 
          onClick={() => {
            handleTextChange("Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20. Budget capped at 25199.55 EUR. Please use Dell Enterprise Europe with no exception.");
            setActiveReqId("REQ-000004");
          }}
          className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${activeReqId === "REQ-000004" ? "bg-white/20 text-white border-white/20" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
        >
          Load Edge Case (REQ-000004)
        </button>
        <button 
          onClick={() => {
            handleTextChange("Need IT Project Management Services for the Q3 migration initiative.");
            setActiveReqId("REQ-000001");
          }}
          className={`px-4 py-2 border rounded-full text-xs font-semibold transition-colors ${activeReqId === "REQ-000001" ? "bg-white/20 text-white border-white/20" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
        >
          Load Standard Demo (REQ-000001)
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

      {/* Results — interpretation + policy check only (yellow spec) */}
      {stage === "done" && result && (
        <>
          <RequestInterpretation interpretation={result.request_interpretation} />
          <PolicyCheck           validation={result.validation} />
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
