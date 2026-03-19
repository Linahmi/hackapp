"use client";

const EXAMPLE =
  "Need 240 docking stations matching existing laptop fleet. Must be delivered by 2026-03-20 with premium specification. Budget capped at 25 199.55 EUR. Please use Dell Enterprise Europe with no exception.";

import { Loader2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onLoadExample?: () => void;
  disabled?: boolean;
}

export default function RequestInput({ value, onChange, onSubmit, onLoadExample, disabled = false }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 no-print">
      <div className="flex flex-col gap-1 text-center md:text-left">
        <h2 className="text-gray-900 dark:text-white text-xl font-bold tracking-tight transition-colors duration-300">New Purchase Request</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
          Describe your procurement need in plain language — any format, no constraints.
        </p>
      </div>

      <textarea
        className="w-full rounded-xl px-5 py-4 text-sm leading-relaxed resize-none outline-none transition-all duration-300 animate-pulse-border bg-white dark:bg-[#12151f] text-gray-900 dark:text-white border border-gray-200 dark:border-[#1e2130] focus:border-red-600 focus:ring-[3px] focus:ring-red-600/10 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        style={{
          minHeight: "160px",
        }}
        placeholder="Need 500 laptops for Geneva office, 2 weeks, budget 400k CHF..."
        rows={7}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        onFocus={(e) => {
          e.currentTarget.classList.remove("animate-pulse-border");
        }}
        onBlur={(e) => {
        }}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onLoadExample ? onLoadExample() : onChange(EXAMPLE)}
          disabled={disabled}
          className="text-xs underline underline-offset-2 transition-opacity disabled:opacity-40"
          style={{ color: "#dc2626" }}
        >
          Load example
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={Boolean(disabled || !value.trim())}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          style={{ backgroundColor: "#dc2626" }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#b91c1c"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#dc2626"; }}
        >
          {disabled ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : (
            "Analyze Request"
          )}
        </button>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 transition-colors duration-300">
        Powered by ProcureTrace AI
      </p>
    </div>
  );
}
