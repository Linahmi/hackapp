"use client";

import React, { Fragment } from "react";

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
export type SensitivityFactor = { label: string; impact: number };

// ─── Config ───────────────────────────────────────────────────────────────────

const BRAND_RED = "#C8102E";

const riskChip = {
  Low:  "border-emerald-700 bg-emerald-900/40 text-emerald-400",
  Med:  "border-amber-700   bg-amber-900/40   text-amber-400",
  High: "border-red-700     bg-red-900/40     text-red-400",
};

const esgChip = {
  A: "border-emerald-700 bg-emerald-900/40 text-emerald-400",
  B: "border-sky-700     bg-sky-900/40     text-sky-400",
  C: "border-amber-700   bg-amber-900/40   text-amber-400",
  D: "border-red-700     bg-red-900/40     text-red-400",
};

const auditDot = {
  approved:  "bg-emerald-500",
  blocked:   "bg-red-500",
  escalated: "bg-amber-400",
};

const auditPill = {
  approved:  "bg-emerald-900/50 text-emerald-400",
  blocked:   "bg-red-900/50     text-red-400",
  escalated: "bg-amber-900/50   text-amber-400",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

function Badge({ type }: { type: Supplier["badge"] }) {
  if (type === "best")
    return <Chip className="border-[#dc2626] bg-[#dc2626]/20 text-[#dc2626]">Best match</Chip>;
  if (type === "blocked")
    return <Chip className="border-red-700 bg-red-900/50 text-red-400">Blocked</Chip>;
  return null;
}

function ScoreBar({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex-1 overflow-hidden rounded-full h-1.5" style={{ backgroundColor: "var(--border-subtle)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: accent }}
        />
      </div>
      <span className="w-12 text-right text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{value} / 100</span>
    </div>
  );
}

function SensitivityAnalysis({ factors }: { factors: SensitivityFactor[] }) {
  const max = Math.max(...factors.map((f) => f.impact), 1);
  return (
    <div className="rounded-xl p-5 shadow-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
      <h3 className="text-sm font-semibold text-[color:var(--text-main)]">Sensitivity Analysis</h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
        Relative influence of each factor on the final recommendation
      </p>
      <div className="mt-4 space-y-3">
        {factors.map((f) => {
          const pct = Math.round((f.impact / max) * 100);
          return (
            <div key={f.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm" style={{ color: "var(--text-muted)" }}>{f.label}</span>
              <div className="flex-1 overflow-hidden rounded-full h-2.5" style={{ backgroundColor: "var(--border-subtle)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, backgroundColor: BRAND_RED }}
                />
              </div>
              <span className="w-8 text-right text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                {f.impact}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SupplierComparisonTable({
  suppliers,
  sourceTags,
  conflicts,
  auditTrail,
  sensitivityFactors,
}: {
  suppliers: Supplier[];
  sourceTags?: SourceTag[];
  conflicts?: ConflictWarning[];
  auditTrail?: AuditEntry[];
  sensitivityFactors?: SensitivityFactor[];
}) {
  return (
    <div className="space-y-4">

      {/* Conflict banner */}
      {conflicts && conflicts.length > 0 && (
        <div className="space-y-2">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-amber-800/60 bg-amber-900/20 px-4 py-3 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: "#D97706" }}
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <span className="font-semibold text-amber-400">Conflict detected — </span>
                <span className="text-amber-300/80">{c.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Source tags */}
      {sourceTags && sourceTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Sources:</span>
          {sourceTags.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-card)", color: "var(--text-muted)" }}
            >
              <span className="font-medium" style={{ color: "var(--text-main)" }}>{t.label}</span>
              <span style={{ color: "var(--text-muted)" }}>·</span>
              <span>{t.source}</span>
              <span className={`rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide ${
                t.method === "stated" ? "bg-slate-700 text-slate-300" : "bg-indigo-900/60 text-indigo-300"
              }`}>
                {t.method}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Supplier table */}
      <div className="overflow-hidden rounded-xl shadow-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ backgroundColor: "var(--bg-hover)", borderColor: "var(--border-subtle)" }}>
              {["Supplier", "Price → TCO", "Risk", "ESG", "Score"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {suppliers.map((s) => {
              const isBest    = s.badge === "best";
              const isBlocked = s.badge === "blocked";
              const barAccent = isBest ? "#dc2626" : isBlocked ? "#4B5563" : BRAND_RED;
              const rowBg     = isBest
                ? "bg-[#dc2626]/5"
                : isBlocked
                ? "bg-red-900/10"
                : "bg-transparent";
              const leftBorder = isBest
                ? { borderLeft: "3px solid #dc2626" }
                : isBlocked
                ? { borderLeft: "3px solid #EF4444" }
                : { borderLeft: "3px solid transparent" };

              return (
                <React.Fragment key={s.supplier_id ?? s.name}>
                  <tr
                    className={`${rowBg} transition hover:bg-white/5`}
                    style={leftBorder}
                  >
                    <td className="px-5 py-3.5 align-top">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[color:var(--text-main)]">{s.name}</span>
                        <Badge type={s.badge} />
                      </div>
                      {isBlocked && s.blockedReason && (
                        <p className="mt-1 text-xs text-red-400/80">
                          Rule violation: {s.blockedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <span className="font-medium" style={{ color: "var(--text-main)" }}>{s.price}</span>
                      <span className="mx-1.5" style={{ color: "var(--text-muted)" }}>→</span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>TCO {s.tco}</span>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <Chip className={riskChip[s.risk]}>{s.risk}</Chip>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <Chip className={esgChip[s.esg]}>{s.esg}</Chip>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      {s.score !== null ? (
                        <span className={`font-bold tabular-nums ${isBest ? "text-[#dc2626]" : "text-gray-300"}`}>
                          <span className="text-lg">{s.score}</span>
                          <span className="text-xs font-medium opacity-60"> / 100</span>
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>

                  {/* Score breakdown */}
                  {s.breakdown.length > 0 && (
                    <tr
                      key={`${s.name}-bars`}
                      className={`${rowBg}`}
                      style={leftBorder}
                    >
                      <td colSpan={5} className="px-5 pb-4 pt-0">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 max-w-lg">
                          {s.breakdown.map((b) => (
                            <ScoreBar key={b.label} label={b.label} value={b.value} accent={barAccent} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sensitivity analysis */}
      {sensitivityFactors && sensitivityFactors.length > 0 && (
        <SensitivityAnalysis factors={sensitivityFactors} />
      )}

      {/* Audit trail */}
      {auditTrail && auditTrail.length > 0 && (
        <div className="rounded-xl px-5 py-4 shadow-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Audit Trail
          </h3>
          <ul className="space-y-3">
            {auditTrail.map((entry, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center shrink-0 pt-1">
                  <span className={`h-2 w-2 rounded-full ${auditDot[entry.status]}`} />
                  {i < auditTrail.length - 1 && (
                    <span className="mt-1 block w-px" style={{ height: 16, backgroundColor: "var(--border-subtle)" }} />
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
                  <span className="text-sm leading-snug" style={{ color: "var(--text-muted)" }}>{entry.text}</span>
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
