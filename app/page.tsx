"use client";

import { useState, useEffect } from "react";
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
      // Step 1: intake simulé
      setStage("intake");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Step 2: process simulé
      setStage("processing");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult = {
        request_interpretation: {
          category_l1: "Hardware",
          category_l2: "Accessories",
          quantity: 240,
          unit_of_measure: "units",
          budget_amount: 25199.55,
          currency: "EUR",
          delivery_countries: ["France"],
          required_by_date: "2026-03-20",
          preferred_supplier_stated: "Dell Enterprise Europe"
        },
        confidence_score: 95,
        validation: {
          is_valid: true,
          reasons: ["Budget respecté", "Fournisseurs certifiés"],
        },
        supplier_shortlist: [
          {
            rank: 1,
            supplier_id: "SUP-01",
            supplier_name: "Dell Enterprise Europe",
            composite_score: 0.92,
            unit_price: 104.99,
            total_price: 25197.60,
            standard_lead_time_days: 14,
            preferred: true,
            incumbent: true,
            recommendation_note: "Matches preferred request",
            currency: "EUR"
          },
          {
            rank: 2,
            supplier_id: "SUP-02",
            supplier_name: "TechData Pro",
            composite_score: 0.82,
            unit_price: 110.00,
            total_price: 26400.00,
            standard_lead_time_days: 7,
            currency: "EUR"
          }
        ],
        suppliers_excluded: [
          {
            supplier_id: "SUP-03",
            supplier_name: "UnknownVend",
            reason: "Non certifié par la politique IT"
          }
        ],
        recommendation: {
          status: "pending_approval",
          reason: "Requête dépassant le seuil d'approbation automatique pour la catégorie Hardware.",
          recommended_supplier: "Dell Enterprise Europe",
          recommended_supplier_rationale: "Fournisseur référencé offrant le meilleur score composite.",
        },
        policy_evaluation: {
          approval_threshold: {
            rule_applied: "Hardware > 10,000 EUR",
            quotes_required: 2,
            approvers: ["IT Manager", "Finance Director"]
          }
        },
        escalations: []
      };

      setResult(mockResult);
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

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="w-full max-w-2xl flex flex-col gap-6 animate-pulse mt-4">
          <div className="h-[120px] rounded-xl w-full" style={{ backgroundColor: "#12151f", border: "1px solid #1e2130" }} />
          <div className="h-[80px] rounded-xl w-full" style={{ backgroundColor: "#12151f", border: "1px solid #1e2130" }} />
          <div className="h-[200px] rounded-xl w-full" style={{ backgroundColor: "#12151f", border: "1px solid #1e2130" }} />
        </div>
      )}
    </div>
  );
}
