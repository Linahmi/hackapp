"use client";

type Supplier = {
  supplier_name: string;
  rank: number;
  unit_price: number;
  total_price: number;
  currency: string;
  risk_score: number;
  quality_score: number;
  esg_score: number;
  standard_lead_time_days: number;
  composite_score: number;
  score_breakdown?: Record<string, number>;
  historical_flags?: string[];
  recommendation_note?: string;
  tco?: number;
  tco_note?: string;
};

type Recommendation = {
  status: string;
  reason?: string;
  rationale?: string;
  decision_summary?: string;
  justification?: string;
  next_action?: string;
  key_reasons?: string[];
  risks?: string[];
  preferred_supplier_if_resolved?: string;
  is_auto_approved?: boolean;
};

type Props = {
  recommendation: Recommendation | null;
  topSupplier: Supplier | null;
  runnerUp: Supplier | null;
  currency: string;
};

const SCORE_LABELS: Record<string, string> = {
  price:     "Price competitiveness",
  lead_time: "Delivery speed",
  quality:   "Quality track record",
  risk:      "Risk profile",
  esg:       "ESG compliance",
};

// Weights must match computeFinalScore() in supplier-demo/page.tsx
const SCORE_WEIGHTS: Record<string, number> = {
  price: 30, lead_time: 30, quality: 20, risk: 10, esg: 10,
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}/100`;
}

function buildWinnerReasons(topSupplier: Supplier, runnerUp: Supplier | null) {
  const breakdown = topSupplier.score_breakdown ?? {};
  const weighted = Object.entries(breakdown)
    .filter(([key, value]) => key !== "historical" && typeof value === "number")
    .map(([key, value]) => ({
      key,
      raw: value as number,
      weight: SCORE_WEIGHTS[key] ?? 0,
      contribution: (value as number) * (SCORE_WEIGHTS[key] ?? 0),
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const reasons: string[] = [];
  const strongest = weighted.slice(0, 2);
  strongest.forEach((item) => {
    reasons.push(
      `${SCORE_LABELS[item.key] ?? item.key} carried meaningful weight (${item.weight}%) and scored ${formatPercent(item.raw)} for ${topSupplier.supplier_name}.`
    );
  });

  if (runnerUp) {
    if (topSupplier.total_price < runnerUp.total_price) {
      reasons.push(
        `${topSupplier.supplier_name} is cheaper than ${runnerUp.supplier_name} by ${topSupplier.currency} ${(runnerUp.total_price - topSupplier.total_price).toLocaleString()}.`
      );
    }
    if (topSupplier.standard_lead_time_days < runnerUp.standard_lead_time_days) {
      reasons.push(
        `${topSupplier.supplier_name} delivers faster than ${runnerUp.supplier_name} (${topSupplier.standard_lead_time_days}d vs ${runnerUp.standard_lead_time_days}d standard lead time).`
      );
    }
    if (topSupplier.composite_score > runnerUp.composite_score) {
      reasons.push(
        `${topSupplier.supplier_name} leads the shortlist on composite score (${Math.round(topSupplier.composite_score * 100)} vs ${Math.round(runnerUp.composite_score * 100)}).`
      );
    }
  }

  return reasons.slice(0, 3);
}

function ScoreBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct >= 70 ? "#10B981" : pct >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums w-7 text-right" style={{ color: "var(--text-muted)" }}>{pct}</span>
    </div>
  );
}

export function DecisionJustification({ recommendation, topSupplier, runnerUp, currency }: Props) {
  if (!recommendation || !topSupplier) return null;

  const { rationale, decision_summary, justification, next_action, key_reasons, risks, status } = recommendation;
  const bd = topSupplier.score_breakdown ?? {};
  const isBlocked = status === "cannot_proceed";
  const winnerReasons = !isBlocked ? buildWinnerReasons(topSupplier, runnerUp) : [];

  return (
    <div className="mt-4 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isBlocked ? "#EF4444" : "#10B981" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
            {isBlocked ? "Why this cannot proceed" : "Decision justification — buyer defense"}
          </h3>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{
          backgroundColor: isBlocked ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
          color: isBlocked ? "#FCA5A5" : "#6EE7B7",
          border: `1px solid ${isBlocked ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
        }}>
          {isBlocked ? "Cannot Proceed" : "Defensible Choice"}
        </span>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">

        {/* ── Structured decision justification ── */}
        {(decision_summary || justification || next_action) ? (
          <div className="flex flex-col gap-3">
            {decision_summary && (
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: isBlocked ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)", border: `1px solid ${isBlocked ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"}` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: isBlocked ? "#fca5a5" : "#6ee7b7" }}>Decision</p>
                <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-main)" }}>{decision_summary}</p>
              </div>
            )}
            {justification && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Justification</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-main)" }}>{justification}</p>
              </div>
            )}
            {next_action && (
              <div className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)" }}>
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd"/>
                </svg>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-0.5 text-amber-400">Next Action</p>
                  <p className="text-sm leading-snug" style={{ color: "var(--text-main)" }}>{next_action}</p>
                </div>
              </div>
            )}
          </div>
        ) : rationale ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Decision</p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-main)" }}>{rationale}</p>
          </div>
        ) : null}

        {/* ── Supplier choice summary ── */}
        {!isBlocked && (
          <div className="rounded-lg px-4 py-4" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
              Why {topSupplier.supplier_name}?
            </p>
            {winnerReasons.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {winnerReasons.map((reason, i) => (
                  <div key={i} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)", color: "var(--text-main)" }}>
                    <span className="font-semibold text-emerald-400 mr-1">{i + 1}.</span>
                    {reason}
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-4">
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Unit price</p>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  {currency} {topSupplier.unit_price?.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total price</p>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  {currency} {topSupplier.total_price?.toLocaleString()}
                </p>
              </div>
              {topSupplier.tco && (
                <div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total cost of ownership</p>
                  <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                    {currency} {topSupplier.tco?.toLocaleString()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Lead time</p>
                <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                  {topSupplier.standard_lead_time_days}d standard
                </p>
              </div>
            </div>

            {/* Score breakdown */}
            {Object.keys(bd).length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                  Score breakdown (weight → contribution)
                </p>
                {Object.entries(bd).filter(([k]) => k !== "historical").map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[1fr_auto_60px] items-center gap-3">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {SCORE_LABELS[k] ?? k} <span className="opacity-50">({SCORE_WEIGHTS[k] ?? "—"}%)</span>
                    </span>
                    <div className="w-28">
                      <ScoreBar value={v} />
                    </div>
                    <span className="text-xs tabular-nums text-right" style={{ color: "var(--text-muted)" }}>
                      {((v * (SCORE_WEIGHTS[k] ?? 0)) / 100).toFixed(2)} pts
                    </span>
                  </div>
                ))}
                {"historical" in bd && (
                  <div className="grid grid-cols-[1fr_auto_60px] items-center gap-3">
                    <span className="text-xs text-blue-400">Historical adjustment</span>
                    <div className="w-28" />
                    <span className={`text-xs tabular-nums text-right font-semibold ${(bd.historical as number) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {(bd.historical as number) >= 0 ? "+" : ""}{bd.historical} pts
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Historical flags */}
            {topSupplier.historical_flags && topSupplier.historical_flags.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-col gap-1" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-blue-400">Past performance factors</p>
                {topSupplier.historical_flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span className="mt-0.5 text-blue-400">•</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── vs runner-up ── */}
        {!isBlocked && runnerUp && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              vs #{runnerUp.rank} {runnerUp.supplier_name}
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {[
                { label: "Price diff", val: `${currency} ${(topSupplier.total_price - runnerUp.total_price).toLocaleString()}`, positive: topSupplier.total_price <= runnerUp.total_price },
                { label: "Risk diff", val: `${topSupplier.risk_score} vs ${runnerUp.risk_score}`, positive: topSupplier.risk_score <= runnerUp.risk_score },
                { label: "Score diff", val: `${Math.round(topSupplier.composite_score * 100)} vs ${Math.round(runnerUp.composite_score * 100)}`, positive: topSupplier.composite_score >= runnerUp.composite_score },
              ].map(({ label, val, positive }) => (
                <div key={label} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
                  <p style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className={`font-semibold mt-0.5 ${positive ? "text-emerald-400" : "text-amber-400"}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Key reasons ── */}
        {key_reasons && key_reasons.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              Key decision factors
            </p>
            <div className="flex flex-col gap-1.5">
              {key_reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-hover)", border: "1px solid var(--border-subtle)" }}>
                  <span className="mt-0.5 text-emerald-400 font-bold shrink-0">{i + 1}.</span>
                  <span style={{ color: "var(--text-main)" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Risks ── */}
        {risks && risks.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-amber-400">
              Identified risks — disclose to buyer
            </p>
            <div className="flex flex-col gap-1.5">
              {risks.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm rounded-lg px-3 py-2 border border-amber-900/40 bg-amber-950/20">
                  <span className="mt-0.5 text-amber-400 shrink-0">▲</span>
                  <span style={{ color: "var(--text-main)" }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TCO note ── */}
        {!isBlocked && topSupplier.tco_note && (
          <div className="rounded-lg px-4 py-3 text-xs leading-relaxed border border-white/5" style={{ backgroundColor: "rgba(59,130,246,0.06)", color: "var(--text-muted)" }}>
            <span className="font-semibold text-blue-400">TCO breakdown: </span>
            {topSupplier.tco_note}
          </div>
        )}

      </div>
    </div>
  );
}
