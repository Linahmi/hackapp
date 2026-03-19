"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { useProcurement } from "@/contexts/ProcurementContext";
import {
  SupplierComparisonTable,
  Supplier,
  SourceTag,
  ConflictWarning,
  AuditEntry,
} from "@/components/agent/SupplierComparisonTable";
import { DecisionRow } from "@/components/agent/DecisionRow";
import { EscalationRow } from "@/components/agent/EscalationRow";
import { DecisionJustification } from "@/components/agent/DecisionJustification";
import { EscalationHierarchyPanel } from "@/components/agent/EscalationHierarchyPanel";
import MarketIntelCard, { SupplierIntelResult } from "@/components/MarketIntelCard";

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

type Weights   = { price: number; risk: number; delivery: number; esg: number };
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
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#1A1D27]/80 backdrop-blur-md px-6 py-5 shadow-sm transition-all hover:shadow-md animate-slide-in-right delay-400">
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
  const router = useRouter();
  const { result: contextResult } = useProcurement();
  const [apiResult,    setApiResult]    = useState<any>(null);
  const [buyerRequest, setBuyerRequest] = useState(DEMO_REQUEST);
  const [mounted, setMounted] = useState(false);
  const [marketIntel, setMarketIntel] = useState<SupplierIntelResult[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelFetched, setIntelFetched] = useState(false);
  const [intelError, setIntelError] = useState(false);

  // Prefer context result (survives SPA navigation, reset on refresh).
  // Fall back to sessionStorage for direct page loads where context may be empty.
  useEffect(() => {
    setMounted(true);
    if (contextResult) {
      setApiResult(contextResult);
    } else {
      try {
        const raw = sessionStorage.getItem("procuretrace_result");
        if (raw) setApiResult(JSON.parse(raw));
      } catch {}
    }
    try {
      const savedText = sessionStorage.getItem("procuretrace_request_text") || localStorage.getItem("buyer_request");
      if (savedText) setBuyerRequest(savedText);
    } catch {}
  }, [contextResult]);


  // ─── Market Intelligence auto-trigger ────────────────────────────────────

  useEffect(() => {
    if (!apiResult?.supplier_shortlist?.length || intelFetched || intelLoading) return;
    const validSuppliers = apiResult.supplier_shortlist.filter((s: any) => s?.supplier_id);
    if (!validSuppliers.length) return;
    setIntelLoading(true);
    const names = validSuppliers.map((s: any) => s.supplier_name);
    const category = apiResult.request_interpretation?.category_l2 ?? apiResult.request_interpretation?.category_l1 ?? "enterprise hardware";
    const region = apiResult.request_interpretation?.delivery_countries?.[0] ?? "Europe";
    fetch("/api/supplier-intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suppliers: names, category, region }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setMarketIntel(data.results ?? []))
      .catch(() => setIntelError(true))
      .finally(() => { setIntelLoading(false); setIntelFetched(true); });
  }, [apiResult?.supplier_shortlist]);

  // ─── Multi-Language detection ─────────────────────────────────────────────
  
  const detectedLanguage = useMemo(() => {
    const text = buyerRequest.toLowerCase();
    if (/\b(bonjour|besoin|livraison|merci)\b/.test(text)) return "French 🇫🇷";
    if (/\b(brauche|für|lieferung|bitte|danke|schnell)\b/.test(text)) return "German 🇩🇪";
    if (/\b(hola|necesito|para|entrega|gracias)\b/.test(text)) return "Spanish 🇪🇸";
    if (/\b(ciao|bisogno|consegna|grazie)\b/.test(text)) return "Italian 🇮🇹";
    if (/\b(nodig|levering|alstublieft|dank)\b/.test(text)) return "Dutch 🇳🇱";
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
    
    const getMethod = (key: string): "stated" | "inferred" => {
      const source = ri.field_sources?.[key];
      if (!source) return "stated"; // fallback
      return source.startsWith("inferred") ? "inferred" : "stated";
    };

    const tags: SourceTag[] = [];
    if (ri.quantity)                   tags.push({ label: "Quantity",  source: `${ri.quantity} units`,                              method: getMethod("quantity") });
    if (ri.budget_amount)              tags.push({ label: "Budget",    source: formatAmount(ri.budget_amount, ri.currency || "CHF"), method: getMethod("budget_amount") });
    if (ri.delivery_countries?.length) tags.push({ label: "Location",  source: ri.delivery_countries.join(", "),                    method: getMethod("delivery_countries") });
    if (ri.days_until_required)        tags.push({ label: "Timeline",  source: `${ri.days_until_required} days`,                    method: getMethod("required_by_date") });
    if (ri.preferred_supplier_stated)  tags.push({ label: "Preferred", source: ri.preferred_supplier_stated,                        method: getMethod("preferred_supplier_stated") });
    if (ri.category_l2)                tags.push({ label: "Category",  source: ri.category_l2,                                      method: getMethod("category_l2") });
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
    (at.uncertainty_flags as string[] ?? []).forEach((flag: string) => {
      entries.push({ text: `Uncertainty: ${flag}`, status: "escalated" });
    });
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

  const runnerName    = eligibleRanked[1]?.name ?? "";
  const explanation    = generateExplanation(bestName, runnerName, weights, rawScores);

  const confidence   = apiResult?.confidence_score ?? null;
  const ri           = apiResult?.request_interpretation;

  // ─── Market Price Benchmark (only from API — no client-side estimation) ──────

  const marketBenchmark = useMemo(() => {
    const mb = apiResult?.market_benchmark;
    if (!mb) return null;
    return {
      category: mb.category ?? ri?.category_l2 ?? ri?.category_l1 ?? "Hardware",
      min:      mb.market_min,
      max:      mb.market_max,
      offer:    mb.best_offer_unit_price,
      currency: mb.currency ?? ri?.currency ?? "EUR",
      isAbove:  mb.is_above_market ?? false,
    };
  }, [apiResult, ri]);

  // ─── Validation issues (severity-tagged) ─────────────────────────────────

  const validationIssues = useMemo(() => {
    return (apiResult?.validation?.issues_detected as any[]) ?? [];
  }, [apiResult]);

  // ─── Excluded suppliers (non-blocking filter reasons) ─────────────────────

  const excludedSuppliers = useMemo(() => {
    return (apiResult?.suppliers_excluded as any[]) ?? [];
  }, [apiResult]);

  const isLocked = mounted && !apiResult;

  if (!mounted) return null;


  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen pb-16 transition-colors duration-300 bg-gray-50 dark:bg-[#0f1117] relative">
      
      {isLocked && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 pointer-events-auto">
          <div className="flex flex-col items-center text-center max-w-lg p-8 rounded-3xl bg-[#12151f] border border-[#1e2130] shadow-2xl animate-fade-slide-up">
            <div className="p-4 rounded-2xl bg-red-500/10 text-red-500 mb-6">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
              No analysis yet — Submit a purchase request in the Client Portal to see supplier comparison
            </h2>
            <button
              onClick={() => router.push("/")}
              className="mt-8 rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-red-700 w-full"
              style={{ backgroundColor: "#dc2626" }}
            >
              Go to Client Portal
            </button>
          </div>
        </div>
      )}

      <div className={`transition-all duration-300 ${isLocked ? "blur-[8px] pointer-events-none select-none" : ""}`} aria-hidden={isLocked}>
        {/* Hero Header */}
      <div className="w-full relative overflow-hidden bg-white dark:bg-[#12151f] border-b border-gray-200 dark:border-[#1e2130] px-6 py-12 md:px-12 md:py-16">
        {/* Mesh Gradient Background — Data Command Center */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {/* Glowing orbs */}
          <div className="absolute -top-[15%] -right-[10%] w-[50vw] h-[50vh] rounded-full bg-red-500/20 dark:bg-red-600/15 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" />
          <div className="absolute top-[20%] -left-[15%] w-[45vw] h-[45vh] rounded-full bg-slate-400/20 dark:bg-slate-600/10 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
          <div className="absolute -bottom-[25%] right-[5%] w-[55vw] h-[50vh] rounded-full bg-indigo-400/15 dark:bg-indigo-700/10 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse-slow" style={{ animationDelay: "3s" }} />

          {/* Enterprise Grid Lines */}
          <div
            className="absolute inset-0 opacity-[0.15] dark:opacity-[0.06]"
            style={{
              backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`,
              backgroundSize: `3rem 3rem`,
              maskImage: `radial-gradient(ellipse at 60% 40%, black 30%, transparent 75%)`,
              WebkitMaskImage: `radial-gradient(ellipse at 60% 40%, black 30%, transparent 75%)`,
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end justify-between gap-6 relative z-10">
          <div className="animate-slide-in-left delay-0">
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
            <div className="flex flex-col items-end gap-1.5 bg-white/60 dark:bg-[#0f1117]/80 backdrop-blur-sm px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/5 animate-slide-in-right delay-200">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Decision Confidence</span>
              <span className={`text-4xl font-black tabular-nums tracking-tight ${confidence >= 70 ? "text-emerald-500" : confidence >= 40 ? "text-amber-500" : "text-red-500"}`}>
                {confidence}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-8 space-y-8 relative">
        {/* Content area background elements */}
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          {/* Large gradient wash from top */}
          <div className="absolute -top-[100px] left-1/2 -translate-x-1/2 w-[120%] h-[500px] rounded-full bg-gradient-to-b from-red-400/15 dark:from-red-600/10 via-rose-300/10 dark:via-rose-500/5 to-transparent blur-[60px]" />
          {/* Floating accent orbs — visible */}
          <div className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vh] rounded-full bg-indigo-300/20 dark:bg-indigo-600/10 blur-[80px] animate-pulse-slow" style={{ animationDelay: "2s" }} />
          <div className="absolute top-[55%] -left-[10%] w-[35vw] h-[35vh] rounded-full bg-rose-300/15 dark:bg-rose-500/8 blur-[70px] animate-pulse-slow" style={{ animationDelay: "4s" }} />
          <div className="absolute bottom-[10%] right-[10%] w-[30vw] h-[25vh] rounded-full bg-sky-300/12 dark:bg-sky-600/6 blur-[70px] animate-pulse-slow" style={{ animationDelay: "6s" }} />
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.18] dark:opacity-[0.06]"
            style={{
              backgroundImage: `radial-gradient(circle, #94a3b8 0.8px, transparent 0.8px)`,
              backgroundSize: `28px 28px`,
              maskImage: `linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)`,
              WebkitMaskImage: `linear-gradient(to bottom, transparent, black 5%, black 95%, transparent)`,
            }}
          />
        </div>
        {/* User request context */}
        <div className="flex items-start gap-4 rounded-2xl px-6 py-5 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm animate-scale-fade-in delay-300">
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

        {/* Decision + Justification — most important, shown first */}
        <div className="animate-fade-slide-up delay-150">
          <DecisionRow
            bestName={bestName}
            bestScore={eligibleRanked[0]?.score ?? null}
            bestPrice={bestPrice}
            isAutoApproved={isAutoApproved}
            status={hasBlocking ? "cannot_proceed" : "pending_approval"}
            escalations={realEscalations}
          />
        </div>

        {isFromApi && (
          <div className="animate-fade-slide-up delay-200">
            <DecisionJustification
              recommendation={apiResult?.recommendation ?? null}
              topSupplier={apiResult?.supplier_shortlist?.[0] ?? null}
              runnerUp={apiResult?.supplier_shortlist?.[1] ?? null}
              currency={apiResult?.request_interpretation?.currency ?? "EUR"}
            />
          </div>
        )}


        {/* Case-type escalation contact */}
        {apiResult?.case_type && apiResult.case_type !== "READY_FOR_VALIDATION" && (() => {
          const caseContacts: Record<string, { role: string; action: string; color: string }> = {
            MORE_INFO_REQUIRED:     { role: "Intern / Sourcing Agent",  action: "Follow up with the requester to collect missing information before this request can proceed.", color: "#f59e0b" },
            FAILED_IMPOSSIBLE_DATE: { role: "Intern / Sourcing Agent",  action: "Contact the requester to negotiate a revised delivery deadline or confirm if an alternative date is acceptable.", color: "#f59e0b" },
            NO_SUPPLIER_AVAILABLE:  { role: "Sourcing Specialist",      action: "Identify and onboard a new supplier capable of fulfilling this requirement, or escalate to category management.", color: "#dc2626" },
            SIMILAR_NOT_EXACT_MATCH:{ role: "Procurement Manager",      action: "Review the proposed alternatives with the requester and confirm acceptance of a substitute product or specification.", color: "#6366f1" },
          };
          const c = caseContacts[apiResult.case_type];
          if (!c) return null;
          return (
            <div className="animate-fade-slide-up delay-200 rounded-xl px-5 py-4 flex items-start gap-4 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
              <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}20` }}>
                <svg className="w-4 h-4" style={{ color: c.color }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: c.color }}>Assigned to: {c.role}</p>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{c.action}</p>
              </div>
            </div>
          );
        })()}

        {/* Validation issues (severity-tagged, from AI) */}
        {validationIssues.length > 0 && (
          <div className="animate-slide-in-left delay-600 rounded-2xl overflow-hidden bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
            <div className="px-6 py-3.5 border-b border-gray-200 dark:border-[#1e2130] flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Validation Issues</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold border border-red-500/20">{validationIssues.length}</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {validationIssues.map((issue: any, i: number) => {
                const isCritical = issue.severity === "critical";
                const isHigh     = issue.severity === "high";
                return (
                  <li key={issue.issue_id ?? i} className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                        isCritical ? "bg-red-500/15 text-red-400 border border-red-500/30"
                        : isHigh   ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                   : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                      }`}>
                        {issue.severity ?? "info"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{issue.description}</p>
                        {issue.action_required && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Required: {issue.action_required}
                          </p>
                        )}
                        {issue.issue_id && (
                          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{issue.issue_id} · {issue.type}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div id="supplier-table" className="animate-scale-fade-in delay-700">
          <SupplierComparisonTable
            suppliers={suppliers}
            sourceTags={sourceTags}
            conflicts={conflicts}
            auditTrail={auditTrail}
          />
        </div>

        {/* Excluded suppliers (non-blocked, with explicit reason) */}
        {excludedSuppliers.length > 0 && (
          <div className="animate-fade-slide-up delay-800 rounded-2xl overflow-hidden bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
            <div className="px-6 py-3.5 border-b border-gray-200 dark:border-[#1e2130] flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Suppliers Excluded from Shortlist</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 font-semibold border border-gray-500/20">{excludedSuppliers.length}</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {excludedSuppliers.map((s: any, i: number) => (
                <li key={s.supplier_id ?? i} className="px-6 py-3.5 flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-gray-500/10 text-gray-400 border border-gray-500/20">
                    excluded
                  </span>
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{s.supplier_name}</span>
                    {s.supplier_id && (
                      <span className="ml-2 text-[10px] font-mono text-gray-400 dark:text-gray-500">{s.supplier_id}</span>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Live Market Benchmark */}
        {marketBenchmark && (
          <div className="animate-slide-in-right delay-900 rounded-2xl px-6 py-5 bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
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
              description="Procurement Manager approval required to combine compatible orders"
              note="Potential savings identified, but human validation is needed"
              estimatedSavings={savingsStr}
              approver="Procurement Manager"
              recipientName="Michael Torres"
              recipientDept="Procurement Office"
              actionRequired="Approve or reject the bundle consolidation to unlock potential cost savings before orders are placed separately."
              responseTime="Response needed within 24–48 hours"
              responseEmoji="📋"
            />
          ) : null}
        </div>


        {(intelLoading || intelFetched) && !intelError && (
          <div className="animate-fade-slide-up delay-900">
            <MarketIntelCard results={marketIntel} loading={intelLoading} />
          </div>
        )}
        {intelFetched && intelError && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-4 text-sm font-medium text-amber-700 dark:text-amber-400 animate-fade-slide-up">
            Live market intelligence unavailable — Exa.ai search could not be reached.
          </div>
        )}

      </div>
      </div>
    </main>
  );
}
