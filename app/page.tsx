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
      // Step 1: intake simulé
      setStage("intake");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Step 2: process simulé
      setStage("processing");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult = {
        request_interpretation: {
          currency: "EUR",
          intent: "Achat d'équipement informatique",
          category: "Hardware",
          urgency: "Normal"
        },
        confidence_score: 0.95,
        validation: {
          status: "approved",
          checks: [
            { rule: "Budget Limit", passed: true, details: "Montant estimé dans les limites." },
            { rule: "Approved Vendor", passed: true, details: "Fournisseur référencé." }
          ]
        },
        supplier_shortlist: [
          { name: "TechCorp", price: 4500, delivery_time: "3 jours", rating: 4.8 },
          { name: "OfficeSupplies", price: 4800, delivery_time: "2 jours", rating: 4.5 }
        ],
        suppliers_excluded: [
          { name: "ScamVendor", reason: "Fournisseur non certifié par l'entreprise" }
        ],
        recommendation: "Nous vous recommandons de sélectionner TechCorp. Bien que le temps de livraison soit légèrement plus long, le prix est inférieur et leur note globale est meilleure.",
        policy_evaluation: {
          overall_compliance: "Total",
          notes: "Achat conforme à la politique d'équipement IT."
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
    </div>
  );
}
