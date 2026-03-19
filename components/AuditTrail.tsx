"use client";

import { useState } from "react";

interface Props {
  auditTrail?: {
    policies_checked: string[];
    supplier_ids_evaluated: string[];
    pricing_tiers_applied: string;
    data_sources_used: string[];
    historical_awards_consulted: boolean;
    historical_award_note: string | null;
  };
}

export default function AuditTrail({ auditTrail }: Props) {
  const [open, setOpen] = useState(false);

  if (!auditTrail) return null;

  return (
    <div className="w-full max-w-2xl mt-2 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors m-auto"
        style={{
          backgroundColor: open ? "#1e2130" : "transparent",
          color: open ? "#fff" : "#6b7280",
          border: "1px solid #1e2130",
        }}
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Agent Thought Process
      </button>

      {open && (
        <div
          className="mt-4 rounded-xl p-5 flex flex-col gap-4 text-sm"
          style={{ backgroundColor: "#12151f", border: "1px solid #1e2130" }}
        >
          <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid #1a1d27" }}>
            <span className="text-xl">🧠</span>
            <span className="text-white font-bold">Audit Trail</span>
          </div>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider" style={{ color: "#6b7280" }}>Sources Consulted</span>
              <div className="flex flex-wrap gap-1.5">
                {auditTrail.data_sources_used.map(ds => (
                  <span key={ds} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#1a1d27", color: "#d1d5db" }}>
                    {ds}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider" style={{ color: "#6b7280" }}>Policies Checked</span>
              <div className="flex flex-wrap gap-1.5">
                {auditTrail.policies_checked.map(p => (
                  <span key={p} className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#86efac" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-1 col-span-2">
              <span className="text-xs uppercase tracking-wider" style={{ color: "#6b7280" }}>Evaluation Path</span>
              <p style={{ color: "#9ca3af" }}>
                Evaluated {auditTrail.supplier_ids_evaluated.length} suppliers. Applied pricing rules: <span className="text-white font-mono">{auditTrail.pricing_tiers_applied}</span>.
              </p>
            </div>

            {auditTrail.historical_awards_consulted && auditTrail.historical_award_note && (
              <div className="flex flex-col gap-1 col-span-2 p-3 rounded-lg" style={{ backgroundColor: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
                <span className="text-xs font-semibold" style={{ color: "#60a5fa" }}>Historical Context Used</span>
                <p className="text-xs leading-relaxed" style={{ color: "#93c5fd" }}>{auditTrail.historical_award_note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
