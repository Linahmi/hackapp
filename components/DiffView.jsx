"use client";
import { useState } from "react";

export default function DiffView({ rawText, structured }) {
  const [open, setOpen] = useState(false);

  if (!rawText && !structured) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <h2 className="text-sm font-semibold text-zinc-800">Raw Input vs Structured Output</h2>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-2">
          <div className="bg-white">
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              Raw Text Input
            </p>
            <pre className="whitespace-pre-wrap px-4 py-3 text-xs text-zinc-600 font-mono leading-relaxed max-h-72 overflow-y-auto">
              {rawText ?? "—"}
            </pre>
          </div>
          <div className="bg-white">
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-400 border-b border-zinc-100">
              Structured Interpretation
            </p>
            <pre className="whitespace-pre-wrap px-4 py-3 text-xs text-zinc-600 font-mono leading-relaxed max-h-72 overflow-y-auto">
              {structured ? JSON.stringify(structured, null, 2) : "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
