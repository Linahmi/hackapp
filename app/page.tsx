"use client";

import { useState, useEffect } from "react";
import RequestInput          from "@/components/RequestInput";
import ProgressStepper       from "@/components/ProgressStepper";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";

type Stage = "idle" | "intake" | "processing" | "done" | "error";

export default function Home() {
  const [text,   setText]   = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("buyer_request") ?? "";
    return "";
  });
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
        body: JSON.stringify({ text, request_id: "REQ-000004" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");

      await new Promise(r => setTimeout(r, 800));

      setResult(data);
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

      {/* Progress stepper — visible while loading or done */}
      {stage !== "idle" && stage !== "error" && (
        <ProgressStepper stage={stage === "done" ? "done" : stage} />
      )}

      {/* Error */}
      {stage === "error" && error && (
        <div
          className="w-full max-w-2xl rounded-xl px-5 py-4 text-sm"
          style={{
            backgroundColor: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.3)",
            color: "#fca5a5",
          }}
        >
          <span className="font-semibold">Error: </span>{error}
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
