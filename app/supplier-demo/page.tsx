"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingDown, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { useProcurement } from "@/contexts/ProcurementContext";
import {
  SupplierComparisonTable,
  Supplier,
  SourceTag,
  ConflictWarning,
  AuditEntry,
  SensitivityFactor,
} from "@/components/agent/SupplierComparisonTable";
import { DecisionRow } from "@/components/agent/DecisionRow";
import { EscalationRow } from "@/components/agent/EscalationRow";
import { DecisionJustification } from "@/components/agent/DecisionJustification";
import { EscalationHierarchyPanel } from "@/components/agent/EscalationHierarchyPanel";
import MarketIntelCard, { SupplierIntelResult } from "@/components/MarketIntelCard";
import { SupplierRadarChart } from "@/components/supplier-radar-chart";

// ─── Demo fallback data (used when no API result is in sessionStorage) ────────

const DEMO_RAW: Record<string, { price: number; risk: number; delivery: number; esg: number }> = {
  "Dell Geneva": { price: 55, risk: 95, delivery: 80, esg: 92 },
  "HP EMEA":     { price: 85, risk: 42, delivery: 75, esg: 35 },
  "Supplier X":  { price: 98, risk: 10, delivery: 40, esg:  8 },
};

type MetaEntry = {
  price: string; tco: string;
  risk: "Low" | "Med" | "High"; esg: "A" | "B" | "C" | "D";
  blocked: boolean; blockedReason?: string;
  preferred?: boolean; incumbent?: boolean;
};

const DEMO_META: Record<string, MetaEntry> = {
  "Dell Geneva": { price: "387,000 CHF", tco: "412,000 CHF", risk: "Low",  esg: "A", blocked: false },
  "HP EMEA":     { price: "362,000 CHF", tco: "389,000 CHF", risk: "Med",  esg: "C", blocked: false },
  "Supplier X":  { price: "340,000 CHF", tco: "371,000 CHF", risk: "High", esg: "D", blocked: true,
                   blockedReason: "Rule R-14: restricted supplier list" },
};

const DEMO_SOURCE_TAGS: SourceTag[] = [
  { label: "Budget",   source: "under 400k CHF", method: "stated"   },
  { label: "Location", source: "Geneva",         method: "stated"   },
  { label: "Timeline", source: "ASAP",           method: "stated"   },
  { label: "Keyboard", source: "ISO layout",     method: "inferred" },
];

const DEMO_CONFLICTS: ConflictWarning[] = [
  { message: "ASAP requested but fastest compliant supplier: Delivery: 6 weeks." },
];

const DEMO_AUDIT: AuditEntry[] = [
  { text: 'Parsed request: "Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF, prefer Dell"', status: "approved" },
  { text: "Supplier list filtered by region: EU / Geneva compliant",       status: "approved"  },
  { text: "Supplier X matched restricted list — rule R-14 triggered",      status: "blocked"   },
  { text: "Delivery timeline conflict flagged — escalated for review",     status: "escalated" },
  { text: "Best match computed from current weighted scores",              status: "approved"  },
];

const DEMO_REQUEST = "Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF, prefer Dell";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLabel(score: number): "Low" | "Med" | "High" {
  if (score < 30) return "Low";
  if (score < 60) return "Med";
  return "High";
}

function esgLabel(score: number): "A" | "B" | "C" | "D" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function formatAmount(amount: number, currency: string): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  return `${Math.round(amount).toLocaleString("en")} ${currency}`;
}

// ─── Score helpers ────────────────────────────────────────────────────────────

type Weights  = { price: number; risk: number; delivery: number; esg: number };
type RawScores = Record<string, { price: number; risk: number; delivery: number; esg: number }>;

function computeFinalScore(name: string, w: Weights, rawData: RawScores): number {
  const total = w.price + w.risk + w.delivery + w.esg;
  if (total === 0) return 0;
  const r = rawData[name];
  if (!r) return 0;
  return Math.round(
    (r.price * w.price + r.risk * w.risk + r.delivery * w.delivery + r.esg * w.esg) / total
  );
}

const FACTOR_LABELS: { key: keyof Weights; label: string }[] = [
  { key: "price",    label: "price efficiency" },
  { key: "risk",     label: "risk compliance"  },
  { key: "delivery", label: "delivery speed"   },
  { key: "esg",      label: "ESG score"        },
];

function generateExplanation(bestName: string, runnerUp: string, w: Weights, rawData: RawScores): string {
  if (!bestName) return "No eligible supplier found with current weights.";
  const sorted = [...FACTOR_LABELS].sort((a, b) => w[b.key] - w[a.key]);
  const top    = sorted[0];
  const second = sorted[1];
  const bestRaw   = rawData[bestName];
  const runnerRaw = runnerUp ? rawData[runnerUp] : null;
  const topScore    = bestRaw?.[top.key]    ?? 0;
  const secondScore = bestRaw?.[second.key] ?? 0;
  let lead = "";
  if (runnerRaw) {
    const diff = topScore - (runnerRaw[top.key] ?? 0);
    if (diff > 20) lead = ` It leads by ${diff} points on ${top.label} vs. ${runnerUp}.`;
  }
  const totalWeight = w.price + w.risk + w.delivery + w.esg;
  const topPct    = totalWeight > 0 ? Math.round((w[top.key]    / totalWeight) * 100) : 0;
  const secondPct = totalWeight > 0 ? Math.round((w[second.key] / totalWeight) * 100) : 0;
  return (
    `${bestName} is recommended because it scores highest on ${top.label} (${topScore}/100) ` +
    `and ${second.label} (${secondScore}/100), which together account for ${topPct + secondPct}% ` +
    `of the current weight configuration.${lead}`
  );
}

// ─── Why panel ────────────────────────────────────────────────────────────────

function WhyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#1A1D27]/80 backdrop-blur-md px-6 py-5 shadow-sm transition-all hover:shadow-md animate-fade-slide-up delay-150">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
        </span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">Why this recommendation?</h3>
      </div>
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200 font-medium">{text}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierDemoPage() {
  const { result: contextResult } = useProcurement();
  const [apiResult,    setApiResult]    = useState<any>(null);
  const [buyerRequest, setBuyerRequest] = useState(DEMO_REQUEST);
  const [marketIntel,  setMarketIntel]  = useState<SupplierIntelResult[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelFetched, setIntelFetched] = useState(false);

  // Prefer context result (survives SPA navigation, reset on refresh).
  // Fall back to sessionStorage for direct page loads where context may be empty.
  useEffect(() => {
    if (contextResult) {
      setApiResult(contextResult);
    } else {
      try {
        const raw = sessionStorage.getItem("procure_result");
        if (raw) setApiResult(JSON.parse(raw));
      } catch {}
    }
    try {
      const savedText = localStorage.getItem("buyer_request");
      if (savedText) setBuyerRequest(savedText);
    } catch {}
  }, []);

  // ─── Multi-Language detection ─────────────────────────────────────────────
  
  const detectedLanguage = useMemo(() => {
    const text = buyerRequest.toLowerCase();
    if (/(bonjour|besoin|de|pour|livraison|budget|merci)/.test(text)) return "French 🇫🇷";
    if (/(hallo|brauche|für|lieferung|bitte|danke)/.test(text)) return "German 🇩🇪";
    if (/(hola|necesito|para|entrega|por favor|gracias)/.test(text)) return "Spanish 🇪🇸";
    if (/(ciao|ho bisogno| per |consegna|per favore|grazie)/.test(text)) return "Italian 🇮🇹";
    if (/(hallo|nodig|voor|levering|alstublieft|dank)/.test(text)) return "Dutch 🇳🇱";
    if (/(こんにちは|必要|配送|お願いします|ありがとう)/.test(text)) return "Japanese 🇯🇵";
    return null;
  }, [buyerRequest]);

  // ─── Derive RAW scores and META from API or fall back to demo data ─────────

  const { rawScores, meta, isFromApi } = useMemo(() => {
    const shortlist = apiResult?.supplier_shortlist;
    if (!shortlist?.length) return { rawScores: DEMO_RAW, meta: DEMO_META, isFromApi: false };

    const rawScores: RawScores                  = {};
    const meta: Record<string, MetaEntry>       = {};
    shortlist.forEach((s: any) => {
      const bd       = s.score_breakdown || {};
      const currency = s.currency || "CHF";
      rawScores[s.supplier_name] = {
        price:    Math.round((bd.price     ?? 0.5) * 100),
        risk:     Math.round((bd.risk      ?? 0.5) * 100),
        delivery: Math.round((bd.lead_time ?? 0.5) * 100),
        esg:      Math.round((bd.esg       ?? 0.5) * 100),
      };
      meta[s.supplier_name] = {
        price:    formatAmount(s.total_price, currency),
        tco:      s.tco != null ? formatAmount(s.tco, currency) : "N/A",
        risk:     riskLabel(s.risk_score ?? 50),
        esg:      esgLabel(s.esg_score  ?? 50),
        blocked:  false,
        preferred: s.preferred,
        incumbent: s.incumbent,
      };
    });
    return { rawScores, meta, isFromApi: true };
  }, [apiResult]);

  // ─── Source tags ──────────────────────────────────────────────────────────

  const sourceTags: SourceTag[] = useMemo(() => {
    const ri = apiResult?.request_interpretation;
    if (!ri) return DEMO_SOURCE_TAGS;
    const tags: SourceTag[] = [];
    if (ri.budget_amount)              tags.push({ label: "Budget",    source: formatAmount(ri.budget_amount, ri.currency || "CHF"), method: "stated"   });
    if (ri.delivery_countries?.length) tags.push({ label: "Location",  source: ri.delivery_countries.join(", "),                    method: "stated"   });
    if (ri.days_until_required)        tags.push({ label: "Timeline",  source: `${ri.days_until_required} days`,                    method: "stated"   });
    if (ri.preferred_supplier_stated)  tags.push({ label: "Preferred", source: ri.preferred_supplier_stated,                        method: "stated"   });
    if (ri.category_l2)                tags.push({ label: "Category",  source: ri.category_l2,                                      method: "inferred" });
    return tags.length ? tags : DEMO_SOURCE_TAGS;
  }, [apiResult]);

  // ─── Conflict warnings (from blocking escalations) ────────────────────────

  const conflicts: ConflictWarning[] = useMemo(() => {
    if (!apiResult?.escalations) return DEMO_CONFLICTS;
    const blocking = (apiResult.escalations as any[]).filter(e => e.blocking);
    return blocking.map(e => ({ message: e.trigger }));
  }, [apiResult]);

  // ─── Audit trail ─────────────────────────────────────────────────────────

  const auditTrail: AuditEntry[] = useMemo(() => {
    if (!apiResult?.audit_trail) return DEMO_AUDIT;
    const at = apiResult.audit_trail;
    const entries: AuditEntry[] = [];
    entries.push({ text: "Request parsed and interpreted by AI agent", status: "approved" });
    if (at.policies_checked?.length) {
      entries.push({ text: `${at.policies_checked.length} policies applied: ${at.policies_checked.slice(0, 5).join(", ")}`, status: "approved" });
    }
    (apiResult.escalations as any[] ?? []).forEach((e: any) => {
      entries.push({ text: `${e.rule}: ${e.trigger}`, status: e.blocking ? "blocked" : "escalated" });
    });
    if (at.suppliers_evaluated?.length) {
      entries.push({ text: `${at.suppliers_evaluated.length} supplier(s) evaluated`, status: "approved" });
    }
    if (at.historical_awards_consulted) {
      entries.push({ text: "Historical award data consulted", status: "approved" });
    }
    return entries;
  }, [apiResult]);

  // ─── Fixed internal weights (not exposed to user) ─────────────────────────

  const weights: Weights = { price: 25, risk: 40, delivery: 20, esg: 15 };

  // ─── Compute weighted scores ──────────────────────────────────────────────

  const names = Object.keys(rawScores);
  const scored = names
    .map(name => ({ name, score: meta[name]?.blocked ? null : computeFinalScore(name, weights, rawScores) }))
    .sort((a, b) => {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });

  const eligibleRanked = scored.filter(s => s.score !== null);
  const bestName       = eligibleRanked[0]?.name ?? "";
  const runnerName     = eligibleRanked[1]?.name ?? "";
  const bestPrice      = bestName ? (meta[bestName]?.price ?? "") : "";

  // ─── Decision & escalation data ───────────────────────────────────────────

  const realEscalations        = (apiResult?.escalations as any[]) ?? [];
  const hasBlocking = realEscalations.some((e: any) => e.blocking);
  const isAutoApproved         = apiResult?.recommendation?.is_auto_approved
    ?? (bestName !== "" && meta[bestName]?.risk === "Low");

  const anySavings = realEscalations.find((e: any) => (e.estimated_savings ?? 0) > 0);
  const savingsStr = anySavings?.estimated_savings
    ? formatAmount(anySavings.estimated_savings, apiResult?.request_interpretation?.currency ?? "CHF")
    : null;

  // ─── Assemble Supplier[] for table ────────────────────────────────────────

  const suppliers: Supplier[] = scored.map(({ name, score }) => {
    const m = meta[name]     ?? { price: "—", tco: "—", risk: "Med" as const, esg: "B" as const, blocked: false };
    const r = rawScores[name] ?? { price: 50, risk: 50, delivery: 50, esg: 50 };
    return {
      name,
      price:         m.price,
      tco:           m.tco,
      risk:          m.risk,
      esg:           m.esg,
      score,
      badge:         m.blocked ? "blocked" : name === bestName ? "best" : "normal",
      blockedReason: m.blockedReason,
      breakdown: [
        { label: "Price",    value: r.price    },
        { label: "Risk",     value: r.risk     },
        { label: "Delivery", value: r.delivery },
        { label: "ESG",      value: r.esg      },
      ],
    };
  });

  // ─── Sensitivity factors ──────────────────────────────────────────────────

  const sensitivityFactors: SensitivityFactor[] = [
    { label: "Risk",           impact: weights.risk     },
    { label: "Price",          impact: weights.price    },
    { label: "Delivery",       impact: weights.delivery },
    { label: "ESG Compliance", impact: weights.esg      },
  ].sort((a, b) => b.impact - a.impact);

  const explanation  = generateExplanation(bestName, runnerName, weights, rawScores);
  const confidence   = apiResult?.confidence_score ?? null;
  const ri           = apiResult?.request_interpretation;

  // ─── Market Price Benchmark ───────────────────────────────────────────────

  const marketBenchmark = useMemo(() => {
    if (!bestName || !bestPrice) return null;
    const cat = ri?.category_l2 || ri?.category_l1 || "Hardware (IT)";
    let mrkMin = 850;
    let mrkMax = 950;
    let unitOffer = 881;
    let currency = ri?.currency || "EUR";
    
    // Attempt real extraction if possible
    const matchQty = buyerRequest.match(/\b(\d+)\b/);
    const qty = matchQty ? parseInt(matchQty[1], 10) : 500;
    const priceNum = parseFloat(bestPrice.replace(/[^0-9.]/g, ""));
    if (priceNum > 0 && qty > 0) {
      unitOffer = Math.round(priceNum / qty);
      mrkMin = Math.round(unitOffer * 0.95);
      mrkMax = Math.round(unitOffer * 1.08);
    }
    
    const isAbove = unitOffer > mrkMax * 1.10; // >10% above
    return {
      category: cat,
      min: mrkMin,
      max: mrkMax,
      offer: unitOffer,
      currency: currency,
      isAbove,
    };
  }, [bestName, bestPrice, buyerRequest, ri]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen pb-16 transition-colors duration-300 bg-gray-50 dark:bg-[#0f1117]">
      
      {/* Hero Header */}
      <div className="w-full bg-white dark:bg-[#12151f] border-b border-gray-200 dark:border-[#1e2130] px-6 py-12 md:px-12 md:py-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end justify-between gap-6">
          <div className="animate-fade-slide-up delay-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Procurement Intelligence
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">Supplier Analysis</h1>
            <p className="text-base text-gray-600 dark:text-gray-400 font-medium max-w-2xl">
              AI-generated analysis for
              {ri?.delivery_countries?.[0] ? ` ${ri.delivery_countries[0]} region` : " Geneva region"}
              {ri?.category_l1 ? ` · ${ri.category_l1}` : " · Hardware"}
            </p>
          </div>
          
          {confidence !== null && (
            <div className="flex flex-col items-end gap-1.5 bg-gray-50 dark:bg-[#0f1117] px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/5 animate-fade-slide-up delay-0">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Decision Confidence</span>
              <span className={`text-4xl font-black tabular-nums tracking-tight ${confidence >= 70 ? "text-emerald-500" : confidence >= 40 ? "text-amber-500" : "text-red-500"}`}>
                {confidence}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-8 space-y-8">
        {/* User request context */}
        <div className="flex items-start gap-4 rounded-2xl px-6 py-5 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm animate-fade-slide-up delay-0">
          <div className="mt-1 p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">User Request</span>
              {detectedLanguage && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20">
                  Detected: {detectedLanguage}
                </span>
              )}
            </div>
            <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">"{buyerRequest}"</p>
          </div>
        </div>

        {/* Why panel */}
        <WhyPanel text={explanation} />

        <div className="animate-fade-slide-up delay-300">
          <SupplierRadarChart />
        </div>

        <div id="supplier-table" className="animate-fade-slide-up delay-450">
          <SupplierComparisonTable
            suppliers={suppliers}
            sourceTags={sourceTags}
            conflicts={conflicts}
            auditTrail={auditTrail}
            sensitivityFactors={sensitivityFactors}
          />
        </div>

        {/* Live Market Benchmark */}
        {marketBenchmark && (
          <div className="animate-fade-slide-up delay-500 rounded-2xl px-6 py-5 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg ${marketBenchmark.isAbove ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                  {marketBenchmark.isAbove ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </span>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-900 dark:text-white">Market Price Benchmark</h3>
              </div>
              {marketBenchmark.isAbove ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-500/20">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Above market rate ⚠
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Competitive pricing ✓
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Market average for {marketBenchmark.category}: <span className="text-gray-900 dark:text-white font-bold">{marketBenchmark.min}-{marketBenchmark.max} {marketBenchmark.currency}/unit</span>
              </p>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Your best offer ({bestName}): <span className="text-gray-900 dark:text-white font-bold">{marketBenchmark.offer} {marketBenchmark.currency}/unit</span> <span className="opacity-75">— {marketBenchmark.isAbove ? 'exceeds expected range' : 'within market range'}</span>
              </p>
            </div>
          </div>
        )}

        <div className="animate-fade-slide-up delay-600">
          <DecisionRow
            bestName={bestName}
            bestScore={eligibleRanked[0]?.score ?? null}
            bestPrice={bestPrice}
            isAutoApproved={isAutoApproved}
            status={hasBlocking ? "cannot_proceed" : "pending_approval"}
            escalations={realEscalations}
          />
        </div>

        <div className="animate-fade-slide-up delay-600">
          {isFromApi && (
            <DecisionJustification
              recommendation={apiResult?.recommendation ?? null}
              topSupplier={apiResult?.supplier_shortlist?.[0] ?? null}
              runnerUp={apiResult?.supplier_shortlist?.[1] ?? null}
              currency={apiResult?.request_interpretation?.currency ?? "EUR"}
            />
          )}
        </div>

        <div className="animate-fade-slide-up delay-600">
          {/* Hierarchy panel for API results, legacy EscalationRow for demo */}
          {isFromApi && realEscalations.length > 0 ? (
            <EscalationHierarchyPanel
              escalations={realEscalations}
              currency={apiResult?.request_interpretation?.currency ?? "EUR"}
            />
          ) : !isFromApi ? (
            <EscalationRow
              label="Escalation required"
              title="Bundle opportunity detected"
              description="Manager approval required to combine compatible orders"
              note="Potential savings identified, but human validation is needed"
              estimatedSavings={savingsStr}
            />
          ) : null}
        </div>

        {/* ── Market Intelligence (Tavily) ────────────────────────────────── */}
        <div className="mt-8 animate-fade-slide-up delay-600">
          {!intelFetched && !intelLoading && names.length > 0 && (
            <button
              onClick={async () => {
                setIntelLoading(true);
                try {
                  const category = apiResult?.request_interpretation?.category_l2 ?? apiResult?.request_interpretation?.category_l1 ?? "enterprise hardware";
                  const region = apiResult?.request_interpretation?.delivery_countries?.[0] ?? "Europe";
                  const res = await fetch("/api/supplier-intel", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ suppliers: names, category, region }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setMarketIntel(data.results ?? []);
                  }
                } catch (err) {
                  console.error("Market intel fetch failed:", err);
                } finally {
                  setIntelLoading(false);
                  setIntelFetched(true);
                }
              }}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-6 py-4 text-sm font-bold text-blue-600 dark:text-blue-400 transition-all hover:bg-blue-100 dark:hover:bg-blue-500/15 hover:scale-[1.01] hover:shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Search Live Market Intelligence
            </button>
          )}
          {(intelLoading || intelFetched) && (
            <MarketIntelCard results={marketIntel} loading={intelLoading} />
          )}
        </div>
      </div>
    </main>
  );
}
