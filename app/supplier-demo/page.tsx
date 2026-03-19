"use client";

import { useState, useEffect, useMemo } from "react";
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
  tcoBreakdown?: { base_cost: number; reliability_cost: number; lead_time_risk: number; risk_premium: number } | null;
  tcoVsBudgetPct?: number | null;
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

const FIXED_WEIGHTS: Weights = { price: 35, risk: 20, delivery: 25, esg: 20 };

// ─── Why panel ────────────────────────────────────────────────────────────────

function WhyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1D27] px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C8102E]" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Why this recommendation?</h3>
      </div>
      <p className="text-sm leading-relaxed text-gray-200">{text}</p>
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
        tco:      s.tco ? formatAmount(s.tco, currency) : formatAmount(Math.round(s.total_price * 1.06), currency),
        risk:     riskLabel(s.risk_score ?? 50),
        esg:      esgLabel(s.esg_score  ?? 50),
        blocked:  false,
        preferred: s.preferred,
        incumbent: s.incumbent,
        tcoBreakdown: s.tco_breakdown ?? null,
        tcoVsBudgetPct: s.tco_vs_budget_pct ?? null,
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

  const weights = FIXED_WEIGHTS;

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
  const blockingEscalations    = realEscalations.filter(e => e.blocking);
  const nonBlockingEscalations = realEscalations.filter(e => !e.blocking);
  const hasBlocking            = blockingEscalations.length > 0;
  const isAutoApproved         = apiResult?.recommendation?.is_auto_approved
    ?? (bestName !== "" && meta[bestName]?.risk === "Low");

  const firstNB    = nonBlockingEscalations[0];
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
    { label: "Price",          impact: FIXED_WEIGHTS.price    },
    { label: "Delivery",       impact: FIXED_WEIGHTS.delivery },
    { label: "Risk",           impact: FIXED_WEIGHTS.risk     },
    { label: "ESG Compliance", impact: FIXED_WEIGHTS.esg      },
  ];

  const explanation  = generateExplanation(bestName, runnerName, weights, rawScores);
  const confidence   = apiResult?.confidence_score ?? null;
  const ri           = apiResult?.request_interpretation;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 md:py-14" style={{ backgroundColor: "var(--bg-app)" }}>

      {/* Page header */}
      <div className="mb-8 border-b pb-6 flex items-end justify-between" style={{ borderColor: "var(--border-subtle)" }}>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#C8102E]">
            Procurement Intelligence
          </p>
          <h1 className="text-2xl font-bold text-[color:var(--text-main)]">Supplier Comparison</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            AI-generated recommendation
            {ri?.delivery_countries?.[0] ? ` · ${ri.delivery_countries[0]} region` : " · Geneva region"}
            {ri?.category_l1 ? ` · ${ri.category_l1} category` : " · Hardware category"}
          </p>
        </div>
        {confidence !== null && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>AI Confidence</span>
            <span className={`text-2xl font-bold tabular-nums ${confidence >= 70 ? "text-emerald-400" : confidence >= 40 ? "text-amber-400" : "text-red-400"}`}>
              {confidence}%
            </span>
          </div>
        )}
      </div>

      {/* User request context */}
      <div className="mb-5 flex items-start gap-3 rounded-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>User request</span>
          <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text-main)" }}>"{buyerRequest}"</p>
        </div>
      </div>


      {/* Why panel */}
      <div className="mb-5">
        <WhyPanel text={explanation} />
      </div>

      {/* Table + banners + audit + sensitivity */}
      <SupplierRadarChart />

      <div id="supplier-table">
        <SupplierComparisonTable
          suppliers={suppliers}
          sourceTags={sourceTags}
          conflicts={conflicts}
          auditTrail={auditTrail}
          sensitivityFactors={sensitivityFactors}
        />
      </div>

      <DecisionRow
        bestName={bestName}
        bestScore={eligibleRanked[0]?.score ?? null}
        bestPrice={bestPrice}
        isAutoApproved={isAutoApproved}
        status={hasBlocking ? "cannot_proceed" : "pending_approval"}
        escalations={realEscalations}
      />

      {/* Show EscalationRow for non-blocking escalations (real mode) or always in demo mode */}
      {(!isFromApi || nonBlockingEscalations.length > 0) && (
        <EscalationRow
          label={firstNB?.rule ?? "Escalation required"}
          title={firstNB ? "Manual review required" : "Bundle opportunity detected"}
          description={firstNB?.trigger ?? "Manager approval required to combine compatible orders"}
          note={firstNB ? `Escalate to: ${firstNB.escalate_to}` : "Potential savings identified, but human validation is needed"}
          estimatedSavings={savingsStr}
        />
      )}

      {/* ── Market Intelligence (Tavily) ────────────────────────────────── */}
      <div className="mt-6">
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
            className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-6 py-3.5 text-sm font-semibold text-[#3B82F6] transition-all hover:bg-[#3B82F6]/15 hover:border-[#3B82F6]/40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Search Live Market Intelligence
          </button>
        )}
        {(intelLoading || intelFetched) && (
          <MarketIntelCard results={marketIntel} loading={intelLoading} />
        )}
      </div>
    </main>
  );
}
