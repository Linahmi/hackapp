"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RequestInput          from "@/components/RequestInput";
import ProgressStepper       from "@/components/ProgressStepper";
import BundlingOpportunityCard from "@/components/BundlingOpportunityCard";
import AuditPDFExport        from "@/components/AuditPDFExport";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";
import { ProcurementAnalyticsWidget } from "@/components/ProcurementAnalyticsWidget";

type Stage = "idle" | "streaming" | "done" | "error";

const STEP_INDEX: Record<string, number> = {
  parsing: 0, rules: 1, scoring: 2, decision: 3, logged: 4,
};

export default function Home() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [stage,  setStage]  = useState<Stage>("idle");
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  // Real-time pipeline state
  const [activeStep, setActiveStep]       = useState(0);
  const [thinkingText, setThinkingText]   = useState("");
  const [progressPct, setProgressPct]     = useState(0);

  function handleTextChange(val: string) {
    setText(val);
    localStorage.setItem("buyer_request", val);
  }

  useEffect(() => {
    const savedText = localStorage.getItem("buyer_request");
    if (savedText) setText(savedText);

    try {
      if (sessionStorage.getItem("session_active") === "true") {
        const savedResult = sessionStorage.getItem("procure_result");
        if (savedResult) {
          setResult(JSON.parse(savedResult));
          setStage("done");
        }
      }
    } catch {}
  }, []);

  async function handleLoadExample() {
    try {
      const res = await fetch("/api/demo");
      if (!res.ok) return;
      const demos = await res.json();
      if (demos?.[0]?.request_text) handleTextChange(demos[0].request_text);
    } catch {
      // silently ignore
    }
  }

  async function handleSubmit() {
    if (!text.trim()) return;
    setError(null);
    setResult(null);
    setActiveStep(0);
    setThinkingText("");
    setProgressPct(0);
    setStage("streaming");

    try {
      const res = await fetch("/api/process-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Stream connection failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || ""; // keep incomplete chunk

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            if (line.startsWith("data: ")) eventData = line.slice(6);
          }

          if (!eventType || !eventData) continue;

          try {
            const payload = JSON.parse(eventData);

            if (eventType === "step") {
              const idx = STEP_INDEX[payload.step] ?? 0;
              if (payload.status === "active") {
                setActiveStep(idx);
              } else if (payload.status === "done") {
                setActiveStep(idx + 1);
              }
              if (payload.thinking) {
                setThinkingText(payload.thinking);
              }
              if (payload.pct !== undefined) {
                setProgressPct(payload.pct);
              }
            }

            if (eventType === "result") {
              setResult(payload);
              sessionStorage.setItem("procure_result", JSON.stringify(payload));
              sessionStorage.setItem("session_active", "true");
              setStage("done");
            }

            if (eventType === "error") {
              throw new Error(payload.message || "Pipeline error");
            }
          } catch (parseErr: any) {
            if (eventType === "error") throw parseErr;
          }
        }
      }

      // If we got here without a result event, fall back
      if (stage !== "done" && !result) {
        setStage("done");
      }
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
      setStage("error");
    }
  }

  const isLoading = stage === "streaming";

  return (
    <div
      className="flex flex-col items-center gap-8 px-4 py-16"
      style={{ backgroundColor: "var(--bg-app)", minHeight: "calc(100vh - 49px)" }}
    >
      <ProcurementAnalyticsWidget />

      <RequestInput
        value={text}
        onChange={handleTextChange}
        onSubmit={handleSubmit}
        onLoadExample={handleLoadExample}
        disabled={isLoading}
      />

      {/* Real-time progress stepper */}
      {(stage === "streaming" || stage === "done") && (
        <ProgressStepper
          activeStep={stage === "done" ? 5 : activeStep}
          thinkingText={thinkingText}
          done={stage === "done"}
          pct={stage === "done" ? 100 : progressPct}
        />
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