"use client";

import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Supplier = {
  supplier_id?: string;
  name: string;
  price: string;
  tco: string;
  risk: "Low" | "Med" | "High";
  esg: "A" | "B" | "C" | "D";
  score: number | null;
  badge: "best" | "blocked" | "normal";
  blockedReason?: string;
  breakdown: { label: string; value: number }[];
};

export type SourceTag      = { label: string; source: string; method: "stated" | "inferred" };
export type ConflictWarning = { message: string };
export type AuditEntry     = { text: string; status: "approved" | "blocked" | "escalated" };

// ─── Config ───────────────────────────────────────────────────────────────────

const riskChip = {
  Low:  "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
  Med:  "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  High: "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400",
};

const esgChip = {
  A: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
  B: "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400",
  C: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
  D: "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400",
};

const auditDot = {
  approved:  "bg-emerald-500",
  blocked:   "bg-red-500",
  escalated: "bg-amber-500",
};

const auditPill = {
  approved:  "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400",
  blocked:   "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400",
  escalated: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

// ─── Advantage tag computation ─────────────────────────────────────────────────
// A tag appears only if this supplier strictly leads on that criterion vs all others.

type AdvantageTag = "Best price" | "Lowest risk" | "Fastest delivery" | "Best ESG";

const ADVANTAGE_KEYS: { tag: AdvantageTag; breakdown: string }[] = [
  { tag: "Best price",       breakdown: "Price"    },
  { tag: "Lowest risk",      breakdown: "Risk"     },
  { tag: "Fastest delivery", breakdown: "Delivery" },
  { tag: "Best ESG",         breakdown: "ESG"      },
];

function computeAdvantages(supplier: Supplier, allSuppliers: Supplier[]): AdvantageTag[] {
  const eligible = allSuppliers.filter(s => s.badge !== "blocked");
  if (eligible.length <= 1) return [];

  const getVal = (s: Supplier, key: string): number =>
    s.breakdown.find(b => b.label === key)?.value ?? 0;

  const result: AdvantageTag[] = [];
  for (const { tag, breakdown: key } of ADVANTAGE_KEYS) {
    const myVal    = getVal(supplier, key);
    const allVals  = eligible.map(s => getVal(s, key));
    const maxVal   = Math.max(...allVals);
    const countMax = allVals.filter(v => v === maxVal).length;
    // Only award tag if this supplier strictly leads (no tie)
    if (myVal === maxVal && countMax === 1) result.push(tag);
    if (result.length === 3) break;
  }
  return result;
}

function ScorePill({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${muted ? "border-gray-200/70 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] text-gray-400 dark:text-gray-500" : "border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] text-gray-700 dark:text-gray-300"}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value} / 100</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SupplierComparisonTable({
  suppliers,
  sourceTags,
  conflicts,
  auditTrail,
}: {
  suppliers: Supplier[];
  sourceTags?: SourceTag[];
  conflicts?: ConflictWarning[];
  auditTrail?: AuditEntry[];
}) {
  const eligibleCount = suppliers.filter(s => s.badge !== "blocked").length;

  return (
    <div className="space-y-4">

      {/* Conflict warnings */}
      {conflicts && conflicts.length > 0 && (
        <div className="space-y-2">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: "#D97706" }}
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <span className="font-semibold text-amber-700 dark:text-amber-400">Conflict detected — </span>
                <span className="text-amber-600 dark:text-amber-300/80">{c.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source tags */}
      {sourceTags && sourceTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Sources:</span>
          {sourceTags.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-400"
            >
              <span className="font-bold text-gray-900 dark:text-gray-200">{t.label}</span>
              <span className="opacity-50">·</span>
              <span>{t.source}</span>
              <span className={`rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide ${
                t.method === "stated"
                  ? "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
                  : "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
              }`}>
                {t.method}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Supplier cards */}
      <div className="overflow-hidden rounded-xl shadow-sm bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130]">

        {/* Section header */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Supplier Shortlist
          </span>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
            {eligibleCount} eligible · {suppliers.length - eligibleCount} restricted
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {suppliers.map((s) => {
            const isBest    = s.badge === "best";
            const isBlocked = s.badge === "blocked";
            const advantages = isBlocked ? [] : computeAdvantages(s, suppliers);

            return (
              <div
                key={s.supplier_id ?? s.name}
                className={`px-6 py-5 transition-colors ${
                  isBest
                    ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                    : isBlocked
                    ? "bg-gray-50/80 dark:bg-white/[0.02] opacity-60"
                    : "bg-white dark:bg-transparent"
                }`}
                style={
                  isBest
                    ? { borderLeft: "3px solid #10b981" }
                    : isBlocked
                    ? { borderLeft: "3px solid #ef4444" }
                    : { borderLeft: "3px solid transparent" }
                }
              >
                <div className="flex items-start justify-between gap-6">

                  {/* Left — identity, tags, pricing */}
                  <div className="min-w-0 flex-1">

                    {/* Name + status badge */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-lg font-bold leading-tight ${
                        isBlocked ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"
                      }`}>
                        {s.name}
                      </span>
                      {isBest && (
                        <span className="inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 leading-none">
                          Best match
                        </span>
                      )}
                      {isBlocked && (
                        <span className="inline-block rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 leading-none">
                          Restricted
                        </span>
                      )}
                    </div>

                    {/* Advantage tags — only for eligible, only if leads */}
                    {advantages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {advantages.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700/40"
                          >
                            ✦ {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Price + TCO */}
                    <div className="flex items-baseline gap-1.5 mb-3">
                      <span className={`text-base font-bold ${
                        isBlocked ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"
                      }`}>
                        {s.price}
                      </span>
                      <span className={`text-xs ${
                        isBlocked ? "text-gray-400/60 dark:text-gray-600" : "text-gray-400 dark:text-gray-500"
                      }`}>
                        · TCO {s.tco}
                      </span>
                    </div>

                    {/* Risk + ESG chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip className={`${riskChip[s.risk]} ${isBlocked ? "opacity-50" : ""}`}>
                        {s.risk} risk
                      </Chip>
                      <Chip className={`${esgChip[s.esg]} ${isBlocked ? "opacity-50" : ""}`}>
                        ESG {s.esg}
                      </Chip>
                    </div>

                    {/* Restriction violation reason */}
                    {isBlocked && s.blockedReason && (
                      <p className="mt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                        ✗ {s.blockedReason}
                      </p>
                    )}

                    {/* Criterion-level breakdown */}
                    {s.breakdown.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {s.breakdown.map((item) => (
                          <ScorePill
                            key={item.label}
                            label={item.label}
                            value={item.value}
                            muted={isBlocked}
                          />
                        ))}
                      </div>
                    )}

                  </div>

                  {/* Right — Global score */}
                  <div className="shrink-0 flex flex-col items-end justify-center pl-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                      Score
                    </span>
                    {s.score !== null ? (
                      <div className={`text-3xl font-black tabular-nums leading-none ${
                        isBest ? "text-emerald-500" : "text-gray-600 dark:text-gray-400"
                      }`}>
                        {s.score}
                        <span className="text-sm font-medium text-gray-400 dark:text-gray-500"> / 100</span>
                      </div>
                    ) : (
                      <div className="text-2xl font-black text-gray-400 dark:text-gray-600 leading-none">—</div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TCO footnote */}
      <p className="text-[10px] leading-relaxed px-1 mt-2 text-gray-400 dark:text-gray-500">
        TCO = base cost + reliability buffer + lead-time risk + operational risk premium. Unit price alone does not reflect total procurement cost.
      </p>

      {/* Audit trail */}
      {auditTrail && auditTrail.length > 0 && (
        <div className="rounded-xl px-6 py-5 shadow-sm bg-white dark:bg-[#12151f] border border-gray-200 dark:border-[#1e2130]">
          <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Audit Trail
          </h3>
          <ul className="space-y-4">
            {auditTrail.map((entry, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0 pt-1.5">
                  <span className={`h-2 w-2 rounded-full ${auditDot[entry.status]}`} />
                  {i < auditTrail.length - 1 && (
                    <span className="mt-1 block w-px h-4 bg-gray-200 dark:bg-white/10" />
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
                  <span className="text-sm leading-snug text-gray-500 dark:text-gray-400">{entry.text}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${auditPill[entry.status]}`}>
                    {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
