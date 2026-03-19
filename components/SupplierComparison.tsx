"use client";

import { useEffect, useState } from "react";

interface Supplier {
  rank: number;
  name: string;
  unitPrice: string;
  totalPrice: string;
  leadDays: number;
  compliant: boolean;
  score: number;
}

const SUPPLIERS: Supplier[] = [
  { rank: 1, name: "Dell Technologies",  unitPrice: "CHF 780", totalPrice: "CHF 390,000", leadDays: 12, compliant: true,  score: 92 },
  { rank: 2, name: "Lenovo B2B Direct",  unitPrice: "CHF 760", totalPrice: "CHF 380,000", leadDays: 18, compliant: true,  score: 84 },
  { rank: 3, name: "HP Enterprise Store", unitPrice: "CHF 810", totalPrice: "CHF 405,000", leadDays: 10, compliant: false, score: 71 },
];

const RANK_LABEL = ["1st", "2nd", "3rd"];

const ESCALATION_REASON = "VP approval required for orders exceeding 250k CHF — human sign-off needed before award.";

export default function SupplierComparison() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top = SUPPLIERS[0];

  return (
    <div
      className={`w-full max-w-2xl mx-auto transition-all duration-500 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      <div
        className="rounded-xl p-6 flex flex-col gap-5"
        style={{ backgroundColor: "#1e2130", border: "1px solid #2a2f42" }}
      >
        {/* Title */}
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 shrink-0"
            style={{ color: "#dc2626" }}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-white font-semibold text-base tracking-tight">
            Supplier Recommendations
          </span>
        </div>

        {/* Supplier cards */}
        <div className="flex flex-col gap-3">
          {SUPPLIERS.map((s) => {
            const isTop = s.rank === 1;
            return (
              <div
                key={s.name}
                className="rounded-lg p-4 flex flex-col gap-3"
                style={{
                  backgroundColor: "#13161f",
                  border: isTop ? "1px solid #dc2626" : "1px solid #2a2f42",
                  boxShadow: isTop ? "0 0 0 3px rgba(220,38,38,0.10)" : "none",
                }}
              >
                {/* Row 1: rank + name + compliance */}
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: isTop ? "#dc2626" : "#2a2f42",
                      color: "#fff",
                    }}
                  >
                    {RANK_LABEL[s.rank - 1]}
                  </span>
                  <span className="text-white font-semibold text-sm flex-1 truncate">
                    {s.name}
                  </span>
                  {s.compliant ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      <span className="text-green-400 text-xs font-medium">Compliant</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "#dc2626" }} />
                      <span className="text-xs font-medium" style={{ color: "#dc2626" }}>Non-compliant</span>
                    </div>
                  )}
                </div>

                {/* Row 2: pricing + lead time */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Unit price</span>
                    <span className="text-white text-sm font-medium">{s.unitPrice}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Total</span>
                    <span className="text-white text-sm font-medium">{s.totalPrice}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Lead time</span>
                    <span className="text-white text-sm font-medium">{s.leadDays} days</span>
                  </div>
                </div>

                {/* Row 3: score bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs uppercase tracking-wider">Score</span>
                    <span className="text-white text-xs font-semibold">{s.score}/100</span>
                  </div>
                  <div className="w-full rounded-full h-1.5" style={{ backgroundColor: "#2a2f42" }}>
                    <div
                      className="h-1.5 rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${s.score}%`,
                        backgroundColor: isTop ? "#dc2626" : "#4b5563",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Decision banner */}
        <div
          className="rounded-lg px-4 py-4 flex flex-col gap-3"
          style={{ backgroundColor: "#13161f", border: "1px solid #2a2f42" }}
        >
          {/* Escalation warning */}
          <div
            className="flex items-start gap-3 rounded-md px-3 py-2.5"
            style={{ backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}
          >
            <span className="text-sm font-bold mt-0.5" style={{ color: "#dc2626" }}>!</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold" style={{ color: "#dc2626" }}>
                Escalation Required — Human review needed
              </span>
              <span className="text-gray-400 text-xs leading-relaxed">{ESCALATION_REASON}</span>
            </div>
          </div>

          {/* Award button */}
          <button
            onClick={() => console.log(`Award to ${top.name}`)}
            className="w-full rounded-lg py-3 text-white font-semibold text-sm tracking-wide transition-colors duration-150"
            style={{ backgroundColor: "#dc2626" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#b91c1c")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
          >
            Award to {top.name}
          </button>
        </div>
      </div>
    </div>
  );
}
