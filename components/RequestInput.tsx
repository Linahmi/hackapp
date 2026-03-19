"use client";

const EXAMPLE =
  "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25 199.55 EUR. Please use Dell Enterprise Europe with no exception.";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function RequestInput({ value, onChange, onSubmit, disabled = false }: Props) {
  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[color:var(--text-main)] text-xl font-bold tracking-tight">New Purchase Request</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Describe your procurement need in plain language — any format, no constraints.
        </p>
      </div>

      <textarea
        className="w-full rounded-xl px-5 py-4 text-sm leading-relaxed resize-none outline-none transition-all duration-200"
        style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-main)",
          border: "1px solid var(--border-card)",
          minHeight: "160px",
        }}
        placeholder="Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF..."
        rows={7}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        onFocus={(e) => {
          e.currentTarget.style.border = "1px solid #dc2626";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(220,38,38,0.12)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = "1px solid var(--border-card)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(EXAMPLE)}
          disabled={disabled}
          className="text-xs underline underline-offset-2 transition-opacity disabled:opacity-40"
          style={{ color: "#dc2626" }}
        >
          Load example
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-[color:var(--text-main)] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#dc2626" }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#b91c1c"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#dc2626"; }}
        >
          {disabled ? "Analysing…" : "Analyze Request"}
        </button>
      </div>

      <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Powered by ProcureTrace AI
      </p>
    </div>
  );
}
