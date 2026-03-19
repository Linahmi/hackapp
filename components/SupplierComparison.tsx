"use client";

import { useEffect, useState } from "react";

interface Supplier {
  rank: number;
  supplier_id: string;
  supplier_name: string;
  composite_score: number;
  unit_price: number;
  total_price: number;
  standard_lead_time_days: number;
  expedited_lead_time_days?: number;
  preferred?: boolean;
  incumbent?: boolean;
  recommendation_note?: string;
  currency?: string;
  score_breakdown?: Record<string, number>;
  tco?: number;
  tco_breakdown?: { base_cost: number; reliability_cost: number; lead_time_risk: number; risk_premium: number };
  tco_note?: string;
  tco_vs_budget_pct?: number | null;
}

interface Excluded {
  supplier_id: string;
  supplier_name: string;
  reason: string;
}

interface Props {
  shortlist?: Supplier[];
  excluded?: Excluded[];
  currency?: string;
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 70 ? "#dc2626" : pct >= 45 ? "#f59e0b" : "var(--text-muted)",
          }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{pct}%</span>
    </div>
  );
}

export default function SupplierComparison({ shortlist = [], excluded = [], currency = "EUR" }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (shortlist.length === 0 && excluded.length === 0) return null;

  return (
    <div
      className="w-full max-w-2xl transition-all duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border-card)" }}>
          <svg className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <span className="text-[color:var(--text-main)] text-sm font-semibold">Supplier Recommendations</span>
          {shortlist.length > 0 && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{shortlist.length} ranked</span>
          )}
        </div>

        {/* Supplier cards */}
        <div className="flex flex-col">
          {shortlist.map((s) => {
            const isTop = s.rank === 1;
            const cur   = s.currency ?? currency;
            return (
              <div
                key={s.supplier_id}
                className="px-5 py-4 flex flex-col gap-3"
                style={{
                  borderBottom: "1px solid var(--border-card)",
                  ...(isTop
                    ? { boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.4)", backgroundColor: "rgba(220,38,38,0.04)" }
                    : {}),
                }}
              >
                {/* Name + rank row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
                      style={{ backgroundColor: isTop ? "#dc2626" : "var(--bg-hover)", color: "var(--text-main)" }}
                    >
                      #{s.rank}
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-[color:var(--text-main)] font-semibold text-sm">{s.supplier_name}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {s.preferred && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#fca5a5" }}>
                            preferred
                          </span>
                        )}
                        {s.incumbent && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(34,197,94,0.10)", color: "#86efac" }}>
                            incumbent
                          </span>
                        )}
                        {s.recommendation_note && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.recommendation_note}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: "rgba(34,197,94,0.10)",
                      color: "#22c55e",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    ✓ Compliant
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-5 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Price</span>
                    <span className="text-sm font-bold text-[color:var(--text-main)] tabular-nums">
                      {cur} {Number(s.total_price).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>TCO Est.</span>
                    {s.tco != null ? (
                      <>
                        <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-main)", fontFamily: "monospace" }}>
                          {cur} {Number(s.tco).toLocaleString()}
                        </span>
                        {s.tco_vs_budget_pct != null && (
                          <span className="text-[10px] font-semibold tabular-nums" style={{ color: s.tco_vs_budget_pct >= 0 ? "#22c55e" : "#ef4444", fontFamily: "monospace" }}>
                            {s.tco_vs_budget_pct >= 0 ? "▼" : "▲"} {Math.abs(s.tco_vs_budget_pct).toFixed(1)}% {s.tco_vs_budget_pct >= 0 ? "under" : "over"} budget
                          </span>
                        )}
                        {s.tco_breakdown && (
                          <span className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                            Base {cur} {s.tco_breakdown.base_cost.toLocaleString()} · Rel. {cur} {s.tco_breakdown.reliability_cost.toLocaleString()} · LT {cur} {s.tco_breakdown.lead_time_risk.toLocaleString()} · Risk {cur} {s.tco_breakdown.risk_premium.toLocaleString()}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Lead Time</span>
                    <span className="text-sm font-bold text-[color:var(--text-main)]">{s.standard_lead_time_days}d</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Score</span>
                    <ScoreBar value={s.composite_score} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Breakdown</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.score_breakdown && Object.entries(s.score_breakdown).map(([k, v]) => (
                        <span key={k} className="text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-main)" }}>
                          {k}: {Math.round(Number(v) * 100)}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Excluded */}
        {excluded.length > 0 && (
          <div className="px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Excluded
            </p>
            <ul className="flex flex-col gap-1">
              {excluded.map((e) => (
                <li key={e.supplier_id} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="font-medium line-through opacity-50" style={{ color: "var(--text-main)" }}>
                    {e.supplier_name}
                  </span>
                  <span>—</span>
                  <span>{e.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* TCO note */}
        {shortlist.some(s => s.tco != null) && (
          <div className="px-5 py-3" style={{ borderTop: "1px solid var(--border-card)" }}>
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              TCO = base cost + reliability buffer + lead-time risk + operational risk premium. Unit price alone does not reflect total procurement cost.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
