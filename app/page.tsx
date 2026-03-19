"use client";

import { useState, useEffect } from "react";
import RequestInput          from "@/components/RequestInput";
import ProgressStepper       from "@/components/ProgressStepper";
import RequestInterpretation from "@/components/RequestInterpretation";
import PolicyCheck           from "@/components/PolicyCheck";
import SupplierComparison    from "@/components/SupplierComparison";
import DecisionCard          from "@/components/DecisionCard";
import AuditTrail            from "@/components/AuditTrail";
import DecisionRow           from "@/components/agent/DecisionRow";

type Stage = "idle" | "intake" | "processing" | "done" | "error";

export default function Home() {
  const [text,   setText]   = useState("");
  const [stage,  setStage]  = useState<Stage>("idle");
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const handleDemo = (e: any) => {
      if (e.detail) {
        setText("Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF, prefer Dell");
      } else {
        setText("");
      }
    };
    window.addEventListener("toggleDemo", handleDemo);
    return () => window.removeEventListener("toggleDemo", handleDemo);
  }, []);

  async function handleSubmit() {
    if (!text.trim()) return;
    setError(null);
    setResult(null);

    try {
      setStage("intake");
      const resIntake = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const dataIntake = await resIntake.json();
      if (!resIntake.ok) throw new Error(dataIntake.error || "Intake failed");

      // Artificial delay to allow 'Parsing' animation
      await new Promise(r => setTimeout(r, 1400));

      setStage("processing");
      const resProcess = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataIntake)
      });
      const dataProcess = await resProcess.json();
      if (!resProcess.ok) throw new Error(dataProcess.error || "Processing failed");

      // Artificial delay to allow processing animations
      await new Promise(r => setTimeout(r, 2200));

      setResult(dataProcess);
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
          />
          <PolicyCheck
            validation={result.validation}
          />
          <SupplierComparison
            shortlist={result.supplier_shortlist ?? []}
            excluded={result.suppliers_excluded ?? []}
            currency={result.request_interpretation?.currency}
          />
          <DecisionRow
            status={result.recommendation?.status ?? "pending_approval"}
            recommendedSupplier={result.recommendation?.recommended_supplier}
            reason={result.recommendation?.reason ?? ""}
            approvers={result.policy_evaluation?.approval_threshold?.approvers ?? []}
          />
          <DecisionCard
            recommendation={result.recommendation}
            policyEvaluation={result.policy_evaluation}
            escalations={result.escalations ?? []}
            confidence={result.confidence_score}
          />
          <AuditTrail auditTrail={result.audit_trail} />
        </>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-pulse mt-4">
          <div className="h-[120px] rounded-xl w-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }} />
          <div className="h-[80px] rounded-xl w-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }} />
          <div className="h-[200px] rounded-xl w-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }} />
        </div>
      )}
    </div>
  );
}
