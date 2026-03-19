"use client";

import { useEffect, useState } from "react";

interface Interpretation {
  category_l1?: string;
  category_l2?: string;
  quantity?: number;
  unit_of_measure?: string;
  budget_amount?: number;
  currency?: string;
  delivery_countries?: string[];
  required_by_date?: string;
  preferred_supplier_stated?: string;
}

interface Props {
  interpretation?: Interpretation;
}

export default function RequestInterpretation({ interpretation }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!interpretation) return null;

  const { category_l1, category_l2, quantity, unit_of_measure, budget_amount, currency, delivery_countries } = interpretation;

  const chips = [
    {
      icon: "🖥️",
      label: "Product",
      value: [category_l1, category_l2].filter(Boolean).join(" › ") || "—",
    },
    {
      icon: "📦",
      label: "Quantity",
      value: quantity != null ? `${quantity}${unit_of_measure ? " " + unit_of_measure : ""}` : "—",
    },
    {
      icon: "📍",
      label: "Location",
      value: delivery_countries?.length ? delivery_countries.join(", ") : "—",
    },
    {
      icon: "💰",
      label: "Budget",
      value: budget_amount != null ? `${currency ?? ""} ${Number(budget_amount).toLocaleString()}`.trim() : "—",
    },
  ];

  return (
    <div
      className="w-full max-w-2xl transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div
        className="rounded-xl p-5 flex flex-col gap-4"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" style={{ color: "#dc2626" }} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span className="text-[color:var(--text-main)] text-sm font-semibold">Request Interpreted</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {chips.map(({ icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col gap-1.5 rounded-lg px-4 py-3"
              style={{ backgroundColor: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {label}
              </span>
              <span className="text-sm font-semibold text-[color:var(--text-main)] leading-tight">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
