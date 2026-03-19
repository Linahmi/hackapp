"use client";

import { useEffect, useState } from "react";

interface FieldSources {
  budget_amount?: string;
  quantity?: string;
  preferred_supplier_stated?: string;
}

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
  field_sources?: FieldSources;
  assumptions?: string[];
}

interface Props {
  interpretation?: Interpretation;
}

const sourceBadgeConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  stated: {
    label: "stated",
    color: "#5DCAA5",
    bg: "rgba(15,110,86,0.08)",
    border: "rgba(15,110,86,0.25)",
  },
  "inferred:history:high": {
    label: "from history",
    color: "#5DCAA5",
    bg: "rgba(15,110,86,0.12)",
    border: "rgba(15,110,86,0.3)",
  },
  "inferred:history:medium": {
    label: "from history",
    color: "#5DCAA5",
    bg: "rgba(15,110,86,0.08)",
    border: "rgba(15,110,86,0.2)",
  },
  "inferred:history:low": {
    label: "inferred — low confidence",
    color: "#BA7517",
    bg: "rgba(186,117,23,0.08)",
    border: "rgba(186,117,23,0.25)",
  },
  "missing:exceeds_threshold": {
    label: "requires confirmation",
    color: "#BA7517",
    bg: "rgba(186,117,23,0.08)",
    border: "rgba(186,117,23,0.25)",
  },
  "missing:low_confidence": {
    label: "requires confirmation",
    color: "#BA7517",
    bg: "rgba(186,117,23,0.08)",
    border: "rgba(186,117,23,0.25)",
  },
  missing: {
    label: "missing",
    color: "#E24B4A",
    bg: "rgba(226,75,74,0.06)",
    border: "rgba(226,75,74,0.25)",
  },
  unknown: {
    label: "unknown",
    color: "#9CA3AF",
    bg: "rgba(156,163,175,0.06)",
    border: "rgba(156,163,175,0.2)",
  },
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const c = sourceBadgeConfig[source] || sourceBadgeConfig["unknown"];
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "9px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: c.color,
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "3px",
        padding: "1px 5px",
        lineHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </span>
  );
}

export default function RequestInterpretation({ interpretation }: Props) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!interpretation) return null;

  const {
    category_l1,
    category_l2,
    quantity,
    unit_of_measure,
    budget_amount,
    currency,
    delivery_countries,
    preferred_supplier_stated,
    field_sources,
    assumptions,
  } = interpretation;

  const chips = [
    {
      icon: "🖥️",
      label: "Product",
      value: [category_l1, category_l2].filter(Boolean).join(" › ") || "—",
      source: undefined,
    },
    {
      icon: "📦",
      label: "Quantity",
      value: quantity != null ? `${quantity}${unit_of_measure ? " " + unit_of_measure : ""}` : "—",
      source: field_sources?.quantity,
    },
    {
      icon: "📍",
      label: "Location",
      value: delivery_countries?.length ? delivery_countries.join(", ") : "—",
      source: undefined,
    },
    {
      icon: "💰",
      label: "Budget",
      value: budget_amount != null ? `${currency ?? ""} ${Number(budget_amount).toLocaleString()}`.trim() : "—",
      source: field_sources?.budget_amount,
    },
    ...(preferred_supplier_stated
      ? [
          {
            icon: "🏢",
            label: "Supplier",
            value: preferred_supplier_stated,
            source: field_sources?.preferred_supplier_stated,
          },
        ]
      : []),
  ];

  const hasAssumptions = assumptions && assumptions.length > 0;

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
          {chips.map(({ icon, label, value, source }) => (
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
              <SourceBadge source={source} />
            </div>
          ))}
        </div>

        {hasAssumptions && (
          <div
            style={{
              backgroundColor: "rgba(15,110,86,0.05)",
              borderLeft: "3px solid rgba(15,110,86,0.4)",
              borderRadius: "0 4px 4px 0",
              padding: "10px 14px",
            }}
          >
            <p
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#5DCAA5",
                marginBottom: "6px",
              }}
            >
              Agent inference log
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
              {assumptions.map((assumption, i) => (
                <li
                  key={i}
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "rgba(15,110,86,0.5)", marginRight: "6px" }}>›</span>
                  {assumption}
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}
