"use client";

import React from "react";

type ScoreBreakdown = {
  price?: number;
  risk?: number;
  lead_time?: number;
  esg?: number;
};

type ShortlistSupplier = {
  rank?: number;
  supplier_name: string;
  total_price: number;
  currency?: string;
  risk_score?: number;
  esg_score?: number;
  composite_score?: number;
  score_breakdown?: ScoreBreakdown;
  standard_lead_time_days?: number;
  preferred?: boolean;
  incumbent?: boolean;
};

type RecommendationData = {
  status?: string;
  decision_summary?: string;
  key_reasons?: string[];
  risks?: string[];
};

interface DecisionExplanationProps {
  shortlist: ShortlistSupplier[];
  recommendation: RecommendationData | null;
  confidenceScore: number | null;
}

export const DecisionExplanation: React.FC<DecisionExplanationProps> = ({
  shortlist,
  recommendation,
  confidenceScore,
}) => {
  if (!shortlist || shortlist.length === 0) return null;

  const top = shortlist[0];
  const others = shortlist.slice(1);

  // Derive reasons if key_reasons is missing
  const reasons: string[] = recommendation?.key_reasons || [];

  if (reasons.length === 0) {
    // 1. Check if lowest price
    const minPrice = Math.min(...shortlist.map((s) => s.total_price));
    if (top.total_price === minPrice) {
      reasons.push("Lowest total price among all eligible suppliers");
    } else if (others.length > 0) {
      const avgPrice = others.reduce((acc, s) => acc + s.total_price, 0) / others.length;
      const savings = ((avgPrice - top.total_price) / avgPrice) * 100;
      if (savings > 5) {
        reasons.push(`${Math.round(savings)}% more cost-effective than the average alternative`);
      }
    }

    // 2. Check if highest ESG
    const maxEsg = Math.max(...shortlist.map((s) => s.esg_score ?? 0));
    if (top.esg_score && top.esg_score === maxEsg) {
      reasons.push(`Superior ESG performance (score: ${top.esg_score}/100)`);
    }

    // 3. Check if lowest Risk
    const minRisk = Math.min(...shortlist.map((s) => s.risk_score ?? 100));
    if (top.risk_score != null && top.risk_score === minRisk) {
      reasons.push(`Lowest risk profile in the current vendor pool (risk score: ${top.risk_score}/100)`);
    }

    // 4. Preferred/Incumbent
    if (top.preferred) reasons.push("Strategic status: Preferred Supplier for this category");
    if (top.incumbent) reasons.push("Historical continuity: Currently serving as Incumbent Supplier");
  }

  const finalReasons = reasons.slice(0, 3);

  // Derive trade-offs (risks)
  const tradeOffs: string[] = recommendation?.risks || [];
  if (tradeOffs.length === 0 && shortlist.length > 1) {
    // Lead time comparison
    const minLeadTime = Math.min(...shortlist.map((s) => s.standard_lead_time_days ?? 999));
    if (top.standard_lead_time_days && top.standard_lead_time_days > minLeadTime) {
      tradeOffs.push(`Longer lead time (${top.standard_lead_time_days} days) compared to fastest alternative`);
    }
  }
  const finalTradeOffs = tradeOffs.slice(0, 2);

  return (
    <div className="bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] rounded-2xl shadow-sm p-6 animate-fade-slide-up delay-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1 block">
            AI Analysis Conclusion
          </span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Decision: {top.supplier_name} — <span className="text-red-600 dark:text-red-400 font-extrabold uppercase">{recommendation?.status?.replace(/_/g, " ") || "Recommended"}</span>
          </h2>
        </div>
        {confidenceScore !== null && (
          <div className="flex flex-col items-end">
             <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">
              Confidence
            </span>
            <span className={`text-2xl font-black tabular-nums ${confidenceScore >= 78 ? "text-emerald-500" : confidenceScore >= 55 ? "text-amber-500" : "text-red-500"}`}>
              {confidenceScore}/100
            </span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-500">✓</span> Why this supplier:
          </h3>
          <ul className="space-y-3">
            {finalReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-3">
                 <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{reason}</p>
              </li>
            ))}
            {finalReasons.length === 0 && (
              <li className="text-sm text-gray-500 italic">No specific advantage identified over runners-up.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-amber-500">△</span> Key trade-offs:
          </h3>
          <ul className="space-y-3">
            {finalTradeOffs.map((trade, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{trade}</p>
              </li>
            ))}
            {finalTradeOffs.length === 0 && (
              <li className="text-sm text-gray-500 italic">No significant trade-offs identified for this selection.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
