"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { DecisionJustification } from "@/components/agent/DecisionJustification";
import { EscalationHierarchyPanel } from "@/components/agent/EscalationHierarchyPanel";
import MarketIntelCard, { SupplierIntelResult } from "@/components/MarketIntelCard";

type ScoreBreakdown = {
  price?: number;
  risk?: number;
  lead_time?: number;
  esg?: number;
};

type ShortlistSupplier = {
  rank?: number;
  supplier_id?: string;
  supplier_name: string;
  currency?: string;
  total_price: number;
  tco?: number | null;
  risk_score?: number;
  esg_score?: number;
  preferred?: boolean;
  incumbent?: boolean;
  composite_score?: number;
  score_breakdown?: ScoreBreakdown;
  standard_lead_time_days?: number;
  recommendation_note?: string;
  historical_flags?: string[];
};

type EscalationData = {
  escalation_id?: string;
  rule: string;
  trigger: string;
  escalate_to?: string;
  hierarchy_level?: number;
  hierarchy_label?: string;
  blocking: boolean;
  action?: string;
  estimated_savings?: number | null;
};

type RequestInterpretationData = {
  field_sources?: Record<string, string>;
  quantity?: number | null;
  budget_amount?: number | null;
  currency?: string | null;
  delivery_countries?: string[];
  days_until_required?: number | null;
  preferred_supplier_stated?: string | null;
  category_l1?: string | null;
  category_l2?: string | null;
};

type AuditTrailData = {
  policies_checked?: string[];
  suppliers_evaluated?: string[];
  historical_awards_consulted?: boolean;
  uncertainty_flags?: string[];
};

type ConfidenceDriver = { tone: "good" | "warn" | "danger"; label: string };

type ApprovalThreshold = {
  rule_applied?: string;
  tier?: number;
  quotes_required?: number;
  approver?: string;
  approvers?: string[];
  deviation_approval?: string | null;
};

type ValidationIssue = {
  issue_id?: string;
  severity?: string;
  description: string;
  action_required?: string;
  type?: string;
};

type ExcludedSupplier = {
  supplier_id?: string;
  supplier_name: string;
  reason: string;
};

type MarketBenchmark = {
  category?: string;
  market_min?: number;
  market_max?: number;
  best_offer_unit_price?: number;
  currency?: string;
  is_above_market?: boolean;
};

type RecommendationData = {
  status?: string;
  is_auto_approved?: boolean;
  next_action?: string;
  decision_summary?: string;
  rationale?: string;
  justification?: string;
  key_reasons?: string[];
  risks?: string[];
};

type ApiResult = {
  supplier_shortlist?: ShortlistSupplier[];
  escalations?: EscalationData[];
  request_interpretation?: RequestInterpretationData;
  audit_trail?: AuditTrailData;
  confidence_score?: number | null;
  confidence_details?: ConfidenceDriver[];
  policy_evaluation?: { approval_threshold?: ApprovalThreshold | null };
  recommendation?: RecommendationData | null;
  case_type?: string;
  market_benchmark?: MarketBenchmark | null;
  validation?: { issues?: ValidationIssue[] };
  suppliers_excluded?: ExcludedSupplier[];
  request_id?: string;
};

function readStoredResult(): ApiResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("procuretrace_result");
    return raw ? JSON.parse(raw) as ApiResult : null;
  } catch {
    return null;
  }
}

function readStoredRequestText() {
  if (typeof window === "undefined") return DEMO_REQUEST;
  try {
    return sessionStorage.getItem("procuretrace_request_text")
      || localStorage.getItem("buyer_request")
      || DEMO_REQUEST;
  } catch {
    return DEMO_REQUEST;
  }
}

// ─── Demo fallback data (used when no API result is in sessionStorage) ────────

const DEMO_RAW: Record<string, { price: number; risk: number; delivery: number; esg: number }> = {
  "Dell Geneva": { price: 55, risk: 95, delivery: 80, esg: 92 },
  "HP EMEA": { price: 85, risk: 42, delivery: 75, esg: 35 },
  "Supplier X": { price: 98, risk: 10, delivery: 40, esg: 8 },
};

type MetaEntry = {
  price: string; tco: string;
  risk: "Low" | "Med" | "High"; esg: "A" | "B" | "C" | "D";
  blocked: boolean; blockedReason?: string;
  preferred?: boolean; incumbent?: boolean;
  totalPriceValue?: number; tcoValue?: number; leadTimeDays?: number;
  recommendationNote?: string; historicalFlags?: string[];
  supplierId?: string;
};

const DEMO_META: Record<string, MetaEntry> = {
  "Dell Geneva": { price: "387,000 CHF", tco: "412,000 CHF", risk: "Low", esg: "A", blocked: false },
  "HP EMEA": { price: "362,000 CHF", tco: "389,000 CHF", risk: "Med", esg: "C", blocked: false },
  "Supplier X": {
    price: "340,000 CHF", tco: "371,000 CHF", risk: "High", esg: "D", blocked: true,
    blockedReason: "Rule R-14: restricted supplier list"
  },
};

const DEMO_SOURCE_TAGS: SourceTag[] = [
  { label: "Budget", source: "under 400k CHF", method: "stated" },
  { label: "Location", source: "Geneva", method: "stated" },
  { label: "Timeline", source: "ASAP", method: "stated" },
  { label: "Keyboard", source: "ISO layout", method: "inferred" },
];

const DEMO_CONFLICTS: ConflictWarning[] = [
  { message: "ASAP requested but fastest compliant supplier: Delivery: 6 weeks." },
];

const DEMO_AUDIT: AuditEntry[] = [
  { text: 'Parsed request: "Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF, prefer Dell"', status: "approved" },
  { text: "Supplier list filtered by region: EU / Geneva compliant", status: "approved" },
  { text: "Supplier X matched restricted list — rule R-14 triggered", status: "blocked" },
  { text: "Delivery timeline conflict flagged — escalated for review", status: "escalated" },
  { text: "Best match computed from current weighted scores", status: "approved" },
];

const DEMO_REQUEST = "Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF, prefer Dell";

// ─── Demo DecisionJustification data ──────────────────────────────────────────

const DEMO_TOP_SUPPLIER = {
  supplier_name: "Dell Geneva",
  rank: 1,
  unit_price: 774,
  total_price: 387000,
  currency: "CHF",
  risk_score: 12,
  quality_score: 88,
  esg_score: 92,
  standard_lead_time_days: 8,
  composite_score: 0.79,
  tco: 412000,
  score_breakdown: { price: 0.55, lead_time: 0.80, quality: 0.88, risk: 0.95, esg: 0.92, historical: 7 },
  historical_flags: [
    "+5 pts based on 4 past awards",
    "+2 pts recent award (last 12 months)",
    "+2 pts reliable (no past escalations)",
    "Clamped from 9 to 8 pts — max historical adjustment applied",
  ],
  recommendation_note: "Preferred supplier — lowest risk, highest ESG",
};

const DEMO_RUNNER_UP = {
  supplier_name: "HP EMEA",
  rank: 2,
  unit_price: 724,
  total_price: 362000,
  currency: "CHF",
  risk_score: 45,
  quality_score: 72,
  esg_score: 35,
  standard_lead_time_days: 12,
  composite_score: 0.63,
  tco: 389000,
  score_breakdown: { price: 0.85, lead_time: 0.75, quality: 0.72, risk: 0.42, esg: 0.35, historical: -3 },
  historical_flags: ["-3 pts based on 1 past rejection"],
};

const DEMO_RECOMMENDATION = {
  status: "recommended",
  is_auto_approved: true,
  decision_summary: "Dell Geneva is recommended as the best compliant supplier for this request.",
  justification: "Dell Geneva leads on risk compliance (95/100) and ESG (92/100), which together account for 50% of the current weight configuration. It is the preferred supplier for the Geneva region with a strong historical track record of 4 past awards and zero escalations.",
  next_action: "Client to validate the order — no further approvals required.",
  key_reasons: [
    "Lowest risk profile in shortlist (risk score 12/100) — well below policy threshold",
    "Preferred supplier for CH region with consistent past performance (+7 pts historical)",
    "ESG grade A — meets sustainability requirements, leads shortlist on environmental criteria",
  ],
  risks: [
    "Unit price is above HP EMEA (CHF 774 vs CHF 724) — TCO difference remains within acceptable range",
    "Standard lead time of 8 days is tight — expedited shipping should be confirmed at order stage",
  ],
};

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

type Weights = { price: number; risk: number; delivery: number; esg: number };
type RawScores = Record<string, { price: number; risk: number; delivery: number; esg: number }>;
const FALLBACK_WEIGHTS: Weights = { price: 25, risk: 40, delivery: 20, esg: 15 };

function computeFinalScore(name: string, w: Weights, rawData: RawScores): number {
  const total = w.price + w.risk + w.delivery + w.esg;
  if (total === 0) return 0;
  const r = rawData[name];
  if (!r) return 0;
  return Math.round(
    (r.price * w.price + r.risk * w.risk + r.delivery * w.delivery + r.esg * w.esg) / total
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierDemoPage() {
  const router = useRouter();
  const { result: contextResult } = useProcurement() as { result: ApiResult | null };
  const [storedApiResult] = useState<ApiResult | null>(() => readStoredResult());
  const [buyerRequest] = useState(() => readStoredRequestText());
  const [marketIntel, setMarketIntel] = useState<SupplierIntelResult[]>([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const intelFetchStarted = useRef(false);
  const apiResult = contextResult ?? storedApiResult;

  // ─── Market Intelligence fetch ────────────────────────────────────────────

  useEffect(() => {
    if (intelFetchStarted.current) return;
    const shortlist = apiResult?.supplier_shortlist;
    if (!shortlist?.length) return;
    const category = apiResult?.request_interpretation?.category_l2;
    if (!category) return;
    const countries: string[] = apiResult?.request_interpretation?.delivery_countries ?? [];
    const region = countries.some((c: string) => ["US", "CA"].includes(c)) ? "US"
      : countries.some((c: string) => ["SG", "JP", "AU"].includes(c)) ? "APAC"
        : "EU";
    const controller = new AbortController();

    intelFetchStarted.current = true;
    setIntelLoading(true);

    fetch("/api/supplier-intel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suppliers: shortlist.slice(0, 3).map((s) => s.supplier_name),
        category,
        region,
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("intel fetch failed");
        return res.json() as Promise<{ results?: SupplierIntelResult[] }>;
      })
      .then((data) => {
        setMarketIntel(data.results ?? []);
      })
      .catch(() => {
        setMarketIntel([]);
      })
      .finally(() => {
        setIntelLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [apiResult]);

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
    if (!apiResult) {
      return { rawScores: DEMO_RAW, meta: DEMO_META, isFromApi: false };
    }

    const shortlist = apiResult?.supplier_shortlist;
    if (!shortlist?.length) return { rawScores: {}, meta: {}, isFromApi: true };

    const rawScores: RawScores = {};
    const meta: Record<string, MetaEntry> = {};
    shortlist.forEach((s) => {
      const bd = s.score_breakdown || {};
      const currency = s.currency || "CHF";
      rawScores[s.supplier_name] = {
        price: Math.round((bd.price ?? 0.5) * 100),
        risk: Math.round((bd.risk ?? 0.5) * 100),
        delivery: Math.round((bd.lead_time ?? 0.5) * 100),
        esg: Math.round((bd.esg ?? 0.5) * 100),
      };
      meta[s.supplier_name] = {
        price: formatAmount(s.total_price, currency),
        tco: s.tco != null ? formatAmount(s.tco, currency) : "N/A",
        risk: riskLabel(s.risk_score ?? 50),
        esg: esgLabel(s.esg_score ?? 50),
        blocked: false,
        preferred: s.preferred,
        incumbent: s.incumbent,
        totalPriceValue: s.total_price,
        tcoValue: s.tco ?? undefined,
        leadTimeDays: s.standard_lead_time_days,
        recommendationNote: s.recommendation_note,
        historicalFlags: s.historical_flags ?? [],
        supplierId: s.supplier_id,
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
    if (ri.quantity) tags.push({ label: "Quantity", source: `${ri.quantity} units`, method: getMethod("quantity") });
    if (ri.budget_amount) tags.push({ label: "Budget", source: formatAmount(ri.budget_amount, ri.currency || "CHF"), method: getMethod("budget_amount") });
    if (ri.delivery_countries?.length) tags.push({ label: "Location", source: ri.delivery_countries.join(", "), method: getMethod("delivery_countries") });
    if (ri.days_until_required) tags.push({ label: "Timeline", source: `${ri.days_until_required} days`, method: getMethod("required_by_date") });
    if (ri.preferred_supplier_stated) tags.push({ label: "Preferred", source: ri.preferred_supplier_stated, method: getMethod("preferred_supplier_stated") });
    if (ri.category_l2) tags.push({ label: "Category", source: ri.category_l2, method: getMethod("category_l2") });
    return tags.length ? tags : DEMO_SOURCE_TAGS;
  }, [apiResult]);

  // ─── Conflict warnings (from blocking escalations) ────────────────────────

  const conflicts: ConflictWarning[] = useMemo(() => {
    if (!apiResult?.escalations) return DEMO_CONFLICTS;
    const blocking = apiResult.escalations.filter((escalation) => escalation.blocking);
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
    (apiResult.escalations ?? []).forEach((e) => {
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

  // ─── Compute displayed scores ─────────────────────────────────────────────

  const scored = useMemo(() => {
    if (apiResult?.supplier_shortlist?.length) {
      return [...apiResult.supplier_shortlist]
        .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
        .map((supplier) => ({
          name: supplier.supplier_name,
          score: typeof supplier.composite_score === "number"
            ? Math.round(supplier.composite_score * 100)
            : null,
        }));
    }

    return Object.keys(rawScores)
      .map((name) => ({ name, score: meta[name]?.blocked ? null : computeFinalScore(name, FALLBACK_WEIGHTS, rawScores) }))
      .sort((a, b) => {
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      });
  }, [apiResult, meta, rawScores]);

  const eligibleRanked = scored.filter(s => s.score !== null);
  const bestName = eligibleRanked[0]?.name ?? "";

  // ─── Decision & escalation data ───────────────────────────────────────────

  const realEscalations = apiResult?.escalations ?? [];
  const hasBlocking = realEscalations.some((e) => e.blocking);
  const isAutoApproved = apiResult?.recommendation?.is_auto_approved
    ?? (bestName !== "" && meta[bestName]?.risk === "Low");

  // ─── DecisionJustification data (demo or API) ─────────────────────────────
  const djTopSupplier = isFromApi
    ? (apiResult?.supplier_shortlist?.[0] ?? null)
    : DEMO_TOP_SUPPLIER;
  const djRunnerUp = isFromApi
    ? (apiResult?.supplier_shortlist?.[1] ?? null)
    : DEMO_RUNNER_UP;
  const djRecommendation = isFromApi
    ? (apiResult?.recommendation ?? null)
    : DEMO_RECOMMENDATION;

  // ─── Assemble Supplier[] for table ────────────────────────────────────────

  const suppliers: Supplier[] = scored.map(({ name, score }) => {
    const m = meta[name] ?? { price: "—", tco: "—", risk: "Med" as const, esg: "B" as const, blocked: false };
    const r = rawScores[name] ?? { price: 50, risk: 50, delivery: 50, esg: 50 };
    return {
      name,
      supplier_id: m.supplierId,
      price: m.price,
      tco: m.tco,
      totalPriceValue: m.totalPriceValue,
      tcoValue: m.tcoValue,
      leadTimeDays: m.leadTimeDays,
      risk: m.risk,
      esg: m.esg,
      score,
      badge: m.blocked ? "blocked" : name === bestName ? "best" : "normal",
      blockedReason: m.blockedReason,
      recommendationNote: m.recommendationNote,
      historicalFlags: m.historicalFlags,
      preferred: m.preferred,
      incumbent: m.incumbent,
      breakdown: [
        { label: "Price", value: r.price },
        { label: "Risk", value: r.risk },
        { label: "Delivery", value: r.delivery },
        { label: "ESG", value: r.esg },
      ],
    };
  });

  const confidence = apiResult?.confidence_score ?? null;
  const confidenceDetails = apiResult?.confidence_details ?? [];
  const ri = apiResult?.request_interpretation;
  // ─── Market Price Benchmark (only from API — no client-side estimation) ──────

  const marketBenchmark = useMemo(() => {
    const mb = apiResult?.market_benchmark;
    if (!mb) return null;
    return {
      category: mb.category ?? ri?.category_l2 ?? ri?.category_l1 ?? "Hardware",
      min: mb.market_min,
      max: mb.market_max,
      offer: mb.best_offer_unit_price,
      currency: mb.currency ?? ri?.currency ?? "EUR",
      isAbove: mb.is_above_market ?? false,
    };
  }, [apiResult, ri]);

  // ─── Validation issues (severity-tagged) ─────────────────────────────────

  const validationIssues = useMemo(() => {
    return apiResult?.validation?.issues ?? [];
  }, [apiResult]);

  // ─── Excluded suppliers (non-blocking filter reasons) ─────────────────────

  const excludedSuppliers = useMemo(() => {
    return apiResult?.suppliers_excluded ?? [];
  }, [apiResult]);

  const isLocked = typeof window !== "undefined" && !apiResult;


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
              <div className="flex flex-col items-end gap-3 bg-white/60 dark:bg-[#0f1117]/80 backdrop-blur-sm px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/5 animate-slide-in-right delay-200 max-w-md">
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Decision Confidence</span>
                  <span className={`text-4xl font-black tabular-nums tracking-tight ${confidence >= 78 ? "text-emerald-500" : confidence >= 55 ? "text-amber-500" : "text-red-500"}`}>
                    {confidence}%
                  </span>
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    Based on request completeness, policy clarity, shortlist strength, and escalation load
                  </span>
                </div>
                {confidenceDetails.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {confidenceDetails.map((item, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold border ${item.tone === "good"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                          : item.tone === "danger"
                            ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                          }`}
                      >
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}
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
              <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">&ldquo;{buyerRequest}&rdquo;</p>
            </div>
          </div>

          {/* Decision + Justification — most important, shown first */}
          <div className="animate-fade-slide-up delay-150">
            <DecisionRow
              bestName={bestName}
              bestScore={eligibleRanked[0]?.score ?? null}
              isAutoApproved={isAutoApproved}
              status={hasBlocking ? "cannot_proceed" : "pending_approval"}
              escalations={realEscalations}
              recommendation={apiResult?.recommendation ?? undefined}
              requestId={apiResult?.request_id}
              topSupplier={apiResult?.supplier_shortlist?.[0] ? {
                score: Math.round((apiResult.supplier_shortlist[0].composite_score ?? 0) * 100),
                unitPrice: apiResult.supplier_shortlist[0].total_price ?? null,
                leadTime: apiResult.supplier_shortlist[0].standard_lead_time_days ?? null,
                currency: apiResult?.request_interpretation?.currency ?? "EUR",
              } : undefined}
            />
          </div>

          {/* Decision justification */}
          {(djTopSupplier || !isFromApi) && (
            <div className="animate-fade-slide-up delay-200">
              <DecisionJustification
                recommendation={djRecommendation ? { ...djRecommendation, status: djRecommendation.status ?? "pending" } : null}
                topSupplier={djTopSupplier as never}
                runnerUp={djRunnerUp as never}
                currency={ri?.currency ?? "CHF"}
              />
            </div>
          )}

          {/* Validation issues (severity-tagged, from AI) */}
          {validationIssues.length > 0 && (
            <div className="animate-slide-in-left delay-600 rounded-2xl overflow-hidden bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
              <div className="px-6 py-3.5 border-b border-gray-200 dark:border-[#1e2130] flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Validation Issues</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-semibold border border-red-500/20">{validationIssues.length}</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {validationIssues.map((issue, i) => {
                  const isCritical = issue.severity === "critical";
                  const isHigh = issue.severity === "high";
                  return (
                    <li key={issue.issue_id ?? i} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${isCritical ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : isHigh ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
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

          {suppliers.length > 0 ? (
            <>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Step 4</p>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Supplier Comparison</h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Compliant options ranked on price, risk, delivery, and ESG</p>
              </div>
              <div id="supplier-table" className="animate-scale-fade-in delay-700">
                <SupplierComparisonTable
                  suppliers={suppliers}
                  sourceTags={sourceTags}
                  conflicts={conflicts}
                  auditTrail={auditTrail}
                />
              </div>
            </>
          ) : (
            <div className="animate-scale-fade-in delay-700 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/8 px-6 py-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2">Step 4</p>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">No Compliant Supplier Available</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                No supplier in the approved panel can fulfill this request within the current constraints. This is different from a similar-match scenario:
                here there are zero compliant supplier options to rank.
              </p>
            </div>
          )}

          {/* Excluded suppliers (non-blocked, with explicit reason) */}
          {excludedSuppliers.length > 0 && (
            <div className="animate-fade-slide-up delay-800 rounded-2xl overflow-hidden bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130] shadow-sm">
              <div className="px-6 py-3.5 border-b border-gray-200 dark:border-[#1e2130] flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Suppliers Excluded from Shortlist</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 font-semibold border border-gray-500/20">{excludedSuppliers.length}</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {excludedSuppliers.map((s, i: number) => (
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
          {marketBenchmark && suppliers.length > 0 && (
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

            {/* Hierarchy panel for API results */}
            {isFromApi && realEscalations.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Step 5</p>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Escalation Routing</h2>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Human approval path for blocking or policy-sensitive cases</p>
                </div>
                <EscalationHierarchyPanel
                  escalations={realEscalations as never}
                  currency={apiResult?.request_interpretation?.currency ?? "EUR"}
                />
              </div>
            ) : null}
          </div>


          {(intelLoading || marketIntel.length > 0) && (
            <div className="animate-fade-slide-up delay-900">
              <MarketIntelCard results={marketIntel} loading={intelLoading} />
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
