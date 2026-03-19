"use client";

import { useState } from "react";
import RequestInput          from "@/components/RequestInput";
import ProgressStepper       from "@/components/ProgressStepper";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";
import SupplierComparison    from "@/components/SupplierComparison";
import DecisionCard          from "@/components/DecisionCard";

type Stage = "idle" | "intake" | "processing" | "done" | "error";

export default function Home() {
  const [text,   setText]   = useState("");
  const [stage,  setStage]  = useState<Stage>("idle");
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit() {
    if (!text.trim()) return;
    setError(null);
    setResult(null);

    try {
      // Step 1: intake — parse raw text → structured request
      setStage("intake");
      const intakeRes = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!intakeRes.ok) {
        const body = await intakeRes.json();
        throw new Error(body.error ?? "Intake failed");
      }
      const intakeData = await intakeRes.json();

      // Step 2: process — run full pipeline on structured request
      setStage("processing");
      const processRes = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intakeData),
      });
      if (!processRes.ok) {
        const body = await processRes.json();
        throw new Error(body.error ?? "Processing failed");
      }
      const processData = await processRes.json();
      setResult(processData);
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
      style={{ backgroundColor: "#0f1117", minHeight: "calc(100vh - 49px)" }}
    >
      <RequestInput
        value={text}
        onChange={setText}
        onSubmit={handleSubmit}
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

      {/* Results — shown progressively after done */}
      {stage === "done" && result && (
        <>
          <RequestInterpretation
            interpretation={result.request_interpretation}
            confidence={result.confidence_score}
          />
          <PolicyCheck
            validation={result.validation}
          />
          <SupplierComparison
            shortlist={result.supplier_shortlist ?? []}
            excluded={result.suppliers_excluded ?? []}
            currency={result.request_interpretation?.currency}
          />
          <DecisionCard
            recommendation={result.recommendation}
            policyEvaluation={result.policy_evaluation}
            escalations={result.escalations ?? []}
          />
        </>
      )}
    </div>
  );
}
