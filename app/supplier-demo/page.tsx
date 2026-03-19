"use client";

import { useState } from "react";
import {
  SupplierComparisonTable,
  Supplier,
  SourceTag,
  ConflictWarning,
  AuditEntry,
  SensitivityFactor,
} from "@/components/agent/SupplierComparisonTable";

// ─── Raw scores (0–100, higher = better in all dimensions) ───────────────────
//
// Design intent — real tradeoffs:
//   Dell:       cheap-ish score low, risk/ESG dominant → wins when compliance matters
//   HP EMEA:    price score high, risk/ESG weak         → wins when cost is top priority
//   Supplier X: cheapest of all, terrible compliance    → always blocked (rule R-14)
//
const RAW = {
  "Dell Geneva": { price: 55, risk: 95, delivery: 80, esg: 92 },
  "HP EMEA":     { price: 85, risk: 42, delivery: 75, esg: 35 },
  "Supplier X":  { price: 98, risk: 10, delivery: 40, esg:  8 },
} as const;

type SupplierName = keyof typeof RAW;

const META: Record<
  SupplierName,
  Pick<Supplier, "price" | "tco" | "risk" | "esg" | "blockedReason"> & { blocked: boolean }
> = {
  "Dell Geneva": { price: "387k", tco: "412k", risk: "Low",  esg: "A", blocked: false },
  "HP EMEA":     { price: "362k", tco: "389k", risk: "Med",  esg: "C", blocked: false },
  "Supplier X":  { price: "340k", tco: "371k", risk: "High", esg: "D", blocked: true,
                   blockedReason: "Rule R-14: restricted supplier list" },
};

// ─── Static page data ─────────────────────────────────────────────────────────

const SOURCE_TAGS: SourceTag[] = [
  { label: "Budget",   source: "under 400k", method: "stated"   },
  { label: "Location", source: "Geneva",     method: "stated"   },
  { label: "Timeline", source: "ASAP",       method: "stated"   },
  { label: "Keyboard", source: "ISO layout", method: "inferred" },
];

const CONFLICTS: ConflictWarning[] = [
  { message: "ASAP requested but fastest compliant supplier delivers in 6 weeks." },
];

const AUDIT_TRAIL: AuditEntry[] = [
  { text: 'Parsed request: "Find a supplier in Geneva under 400k ASAP"',   status: "approved"  },
  { text: "Supplier list filtered by region: EU / Geneva compliant",        status: "approved"  },
  { text: "Supplier X matched restricted list — rule R-14 triggered",       status: "blocked"   },
  { text: "Delivery timeline conflict flagged — escalated for review",      status: "escalated" },
  { text: "Best match computed from current weighted scores",               status: "approved"  },
];

// ─── Score helpers ────────────────────────────────────────────────────────────

type Weights = { price: number; risk: number; delivery: number; esg: number };

function computeFinalScore(name: SupplierName, w: Weights): number {
  const total = w.price + w.risk + w.delivery + w.esg;
  if (total === 0) return 0;
  const r = RAW[name];
  return Math.round(
    (r.price * w.price + r.risk * w.risk + r.delivery * w.delivery + r.esg * w.esg) / total
  );
}

// ─── Explanation generator ────────────────────────────────────────────────────

const FACTOR_LABELS: { key: keyof Weights; label: string }[] = [
  { key: "price",    label: "price efficiency" },
  { key: "risk",     label: "risk compliance"  },
  { key: "delivery", label: "delivery speed"   },
  { key: "esg",      label: "ESG score"        },
];

function generateExplanation(
  bestName: SupplierName | "",
  runnerUp: SupplierName | "",
  w: Weights
): string {
  if (!bestName) return "No eligible supplier found with current weights.";

  // Top 2 factors by weight
  const sorted = [...FACTOR_LABELS].sort((a, b) => w[b.key] - w[a.key]);
  const top    = sorted[0];
  const second = sorted[1];

  const bestRaw    = RAW[bestName];
  const runnerRaw  = runnerUp ? RAW[runnerUp] : null;

  const topScore    = bestRaw[top.key];
  const secondScore = bestRaw[second.key];

  let lead = "";
  if (runnerRaw) {
    const diff = topScore - runnerRaw[top.key];
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

// ─── Slider component ─────────────────────────────────────────────────────────

function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <span className="w-8 text-right text-sm font-bold tabular-nums text-[color:var(--text-main)]">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: "#C8102E" }}
      />
    </div>
  );
}

// ─── Why panel ────────────────────────────────────────────────────────────────

function WhyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1D27] px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C8102E]" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Why this recommendation?
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-gray-200">{text}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierDemoPage() {
  const [priceWeight,    setPriceWeight]    = useState(25);
  const [riskWeight,     setRiskWeight]     = useState(40);
  const [deliveryWeight, setDeliveryWeight] = useState(20);
  const [esgWeight,      setEsgWeight]      = useState(15);

  const weights: Weights = {
    price:    priceWeight,
    risk:     riskWeight,
    delivery: deliveryWeight,
    esg:      esgWeight,
  };

  // Compute scores for all non-blocked suppliers
  const names = Object.keys(RAW) as SupplierName[];

  const scored = names
    .map((name) => ({
      name,
      score: META[name].blocked ? null : computeFinalScore(name, weights),
    }))
    .sort((a, b) => {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    });

  const eligibleRanked = scored.filter((s) => s.score !== null);
  const bestName   = (eligibleRanked[0]?.name ?? "") as SupplierName | "";
  const runnerName = (eligibleRanked[1]?.name ?? "") as SupplierName | "";

  // Assemble Supplier[] for table
  const suppliers: Supplier[] = scored.map(({ name, score }) => {
    const meta = META[name];
    const raw  = RAW[name];
    return {
      name,
      price:         meta.price,
      tco:           meta.tco,
      risk:          meta.risk,
      esg:           meta.esg,
      score,
      badge:         meta.blocked ? "blocked" : name === bestName ? "best" : "normal",
      blockedReason: meta.blockedReason,
      breakdown: [
        { label: "Price",    value: raw.price    },
        { label: "Risk",     value: raw.risk     },
        { label: "Delivery", value: raw.delivery },
        { label: "ESG",      value: raw.esg      },
      ],
    };
  });

  // Sensitivity = weights sorted by value descending
  const sensitivityFactors: SensitivityFactor[] = [
    { label: "Risk",           impact: riskWeight     },
    { label: "Price",          impact: priceWeight    },
    { label: "Delivery",       impact: deliveryWeight },
    { label: "ESG Compliance", impact: esgWeight      },
  ].sort((a, b) => b.impact - a.impact);

  // Explanation text
  const explanation = generateExplanation(bestName, runnerName, weights);

  return (
    <main className="min-h-screen bg-[#0F1117] px-6 py-10 md:px-12 md:py-14">

      {/* Page header */}
      <div className="mb-8 border-b border-white/10 pb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#C8102E]">
          Procurement Intelligence
        </p>
        <h1 className="text-2xl font-bold text-[color:var(--text-main)]">Supplier Comparison</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI-generated recommendation · Geneva region · Hardware category
        </p>
      </div>

      {/* User request context */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-white/10 bg-[#1A1D27] px-5 py-4">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            User request
          </span>
          <p className="mt-0.5 text-sm font-medium text-gray-200">
            "Find a supplier in Geneva under 400k ASAP"
          </p>
        </div>
      </div>

      {/* Weight sliders */}
      <div className="mb-5 rounded-xl border border-white/10 bg-[#1A1D27] px-6 py-5">
        <h2 className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Decision weights
        </h2>
        <p className="mb-5 text-xs text-gray-600">
          Drag sliders to recompute scores — ranking and recommendation update live
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
          <WeightSlider label="Price"    value={priceWeight}    onChange={setPriceWeight}    />
          <WeightSlider label="Risk"     value={riskWeight}     onChange={setRiskWeight}     />
          <WeightSlider label="Delivery" value={deliveryWeight} onChange={setDeliveryWeight} />
          <WeightSlider label="ESG"      value={esgWeight}      onChange={setEsgWeight}      />
        </div>

        {/* Live weight breakdown */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-4">
          {[
            { label: "Price",    value: priceWeight    },
            { label: "Risk",     value: riskWeight     },
            { label: "Delivery", value: deliveryWeight },
            { label: "ESG",      value: esgWeight      },
          ].map(({ label, value }) => {
            const total = priceWeight + riskWeight + deliveryWeight + esgWeight;
            const pct   = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-400"
              >
                {label}
                <span className="font-bold text-[color:var(--text-main)]">{pct}%</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Why panel */}
      <div className="mb-5">
        <WhyPanel text={explanation} />
      </div>

      {/* Table + banners + audit + sensitivity */}
      <SupplierComparisonTable
        suppliers={suppliers}
        sourceTags={SOURCE_TAGS}
        conflicts={CONFLICTS}
        auditTrail={AUDIT_TRAIL}
        sensitivityFactors={sensitivityFactors}
      />
    </main>
  );
}
