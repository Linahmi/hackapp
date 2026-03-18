"use client";

import { useState } from "react";
import Loader from "@/components/Loader";
import RequestCard from "@/components/RequestCard";
import ValidationPanel from "@/components/ValidationPanel";
import SupplierTable from "@/components/SupplierTable";
import EscalationPanel from "@/components/EscalationPanel";
import RecommendationCard from "@/components/RecommendationCard";
import AuditTrail from "@/components/AuditTrail";
import DiffView from "@/components/DiffView";

const EXAMPLE_TEXT =
  "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25 199.55 EUR. Please use Dell Enterprise Europe with no exception.";

type Stage = "idle" | "intake" | "processing" | "done" | "error";

export default function Home() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [intake, setIntake] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setError(null);
    setIntake(null);
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
      setIntake(intakeData);

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
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-lg font-bold text-zinc-900">Procurement Intelligence</h1>
          <p className="text-sm text-zinc-500">Paste a free-text procurement request to analyse it end-to-end.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Input form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-zinc-800">Request Text</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <textarea
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 placeholder-zinc-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none"
              rows={4}
              placeholder="e.g. Need 100 laptops for the Berlin office by end of month, budget EUR 90 000, prefer Dell…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setText(EXAMPLE_TEXT)}
                className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
                disabled={isLoading}
              >
                Load example
              </button>
              <button
                type="submit"
                disabled={isLoading || !text.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {isLoading ? "Analysing…" : "Analyse Request"}
              </button>
            </div>
          </div>
        </form>

        {/* Loading states */}
        {stage === "intake" && <Loader message="Parsing request with Claude…" />}
        {stage === "processing" && <Loader message="Running procurement pipeline…" />}

        {/* Error */}
        {stage === "error" && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <span className="font-semibold">Error: </span>{error}
          </div>
        )}

        {/* Results */}
        {stage === "done" && result && (
          <>
            <RecommendationCard
              recommendation={result.recommendation}
              policyEvaluation={result.policy_evaluation}
            />
            <RequestCard
              interpretation={result.request_interpretation}
              confidence={result.confidence_score}
              requestId={result.request_id}
            />
            <ValidationPanel validation={result.validation} />
            <SupplierTable
              shortlist={result.supplier_shortlist}
              excluded={result.suppliers_excluded}
              currency={result.request_interpretation?.currency}
            />
            <EscalationPanel escalations={result.escalations} />
            <AuditTrail auditTrail={result.audit_trail} processedAt={result.processed_at} />
            <DiffView rawText={text} structured={result.request_interpretation} />
          </>
        )}
      </main>
    </div>
  );
}
