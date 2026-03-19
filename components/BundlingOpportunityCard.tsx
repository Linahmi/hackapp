"use client";

import { useEffect, useState } from "react";

export interface BundlingOpportunity {
  opportunity_detected: boolean;
  type: string;
  title: string;
  description: string;
  current_quantity: number;
  combined_quantity: number;
  similar_requests_count: number;
  current_unit_price: number;
  bundled_unit_price: number;
  estimated_saving: number;
  saving_pct: number;
  currency: string;
  esg_benefit?: string | null;
  dynamic_pricing_projection?: {
    units_needed: number;
    additional_saving: number;
    additional_saving_currency: string;
    message: string;
  } | null;
  antitrust_note: string;
  requires_manager_approval: boolean;
  region: string;
}

interface Props {
  bundlingOpportunity: BundlingOpportunity | null;
}

export default function BundlingOpportunityCard({ bundlingOpportunity }: Props) {
  const [visible, setVisible] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!bundlingOpportunity || !bundlingOpportunity.opportunity_detected) return null;

  const {
    title,
    description,
    current_quantity,
    combined_quantity,
    similar_requests_count,
    current_unit_price,
    bundled_unit_price,
    estimated_saving,
    saving_pct,
    currency,
    esg_benefit,
    dynamic_pricing_projection,
    antitrust_note,
    requires_manager_approval,
    region,
  } = bundlingOpportunity;

  // Formatting helpers
  const formatMoney = (val: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  const formatDigit = (val: number) => new Intl.NumberFormat("en-US").format(val);

  return (
    <div
      className="w-full max-w-2xl transition-all duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(12px)" }}
    >
      <div
        className="rounded-xl p-5 flex flex-col gap-5"
        style={{ backgroundColor: "rgba(15,110,86,0.04)", border: "1px solid rgba(93,202,165,0.25)" }}
      >
        {/* Header Stream */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
             <span className="text-[color:var(--text-main)] font-bold text-base">{title}</span>
             <span
               className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ml-2"
               style={{ backgroundColor: "rgba(93,202,165,0.12)", color: "#5DCAA5" }}
             >
               Bundling Opportunity
             </span>
             <span
               className="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
               style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}
             >
               {region}
             </span>
          </div>
        </div>

        {/* Core Body */}
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>

        {/* High Density Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg" style={{ backgroundColor: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--text-muted)" }}>Volume Shift</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-mono line-through opacity-50">{formatDigit(current_quantity)}</span>
              <span className="text-lg font-mono font-bold" style={{ color: "#5DCAA5" }}>{formatDigit(combined_quantity)}</span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{similar_requests_count} candidate requests</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--text-muted)" }}>Unit Price</span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-mono line-through opacity-50">{formatMoney(current_unit_price)}</span>
              <span className="text-lg font-mono font-bold" style={{ color: "#5DCAA5" }}>{formatMoney(bundled_unit_price)}</span>
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{currency} per unit</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "var(--text-muted)" }}>Projected Saving</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-bold" style={{ color: "#5DCAA5" }}>{formatMoney(estimated_saving)} {currency}</span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block w-fit mt-1" style={{ backgroundColor: "rgba(93,202,165,0.15)", color: "#5DCAA5" }}>
              ↓ {saving_pct}%
            </span>
          </div>
        </div>

        {/* Secondary Projections */}
        {(dynamic_pricing_projection || esg_benefit) && (
          <div className="flex flex-col gap-3">
            {dynamic_pricing_projection && (
              <div className="p-3 rounded-lg border border-dashed flex flex-col gap-1.5" style={{ borderColor: "rgba(93,202,165,0.3)" }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#5DCAA5" }}>Next pricing tier possibility</span>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {dynamic_pricing_projection.message}
                </p>
              </div>
            )}
            
            {esg_benefit && (
              <div className="p-3 rounded-lg flex items-start gap-3" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                <span className="text-sm">♻️</span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold" style={{ color: "var(--text-main)" }}>ESG Alignment</span>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {esg_benefit}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bottom Bar: Action & Audit Warning */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 mt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] leading-relaxed max-w-[65%]" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
            <span className="font-bold">Confidentiality Guard:</span> {antitrust_note}
          </p>

          <div className="shrink-0 flex items-center justify-end w-full sm:w-auto">
            {requires_manager_approval ? (
              <button
                onClick={() => setApproved(true)}
                disabled={approved}
                className="rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 w-full sm:w-auto disabled:opacity-100 disabled:cursor-default"
                style={{ 
                  backgroundColor: approved ? "rgba(93,202,165,0.15)" : "#0F6E56", 
                  color: approved ? "#5DCAA5" : "#fff",
                  border: approved ? "1px solid rgba(93,202,165,0.3)" : "1px solid transparent"
                }}
              >
                {approved ? "✓ Approval Requested" : "Request Bundling Approval"}
              </button>
            ) : (
              <span className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                No additional approval required
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
