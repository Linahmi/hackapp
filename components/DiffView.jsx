"use client";
import { useState } from "react";

export default function DiffView({ rawText, structured }) {
  const [open, setOpen] = useState(false);

  if (!rawText && !structured) return null;

  return (
    <div className="rounded-xl shadow-sm" style={{ border: "1px solid var(--border-card)", backgroundColor: "var(--bg-card)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Raw Input vs Structured Output</h2>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ borderTop: "1px solid var(--border-subtle)", backgroundColor: "var(--border-subtle)" }}>
          <div style={{ backgroundColor: "var(--bg-card)" }}>
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
              Raw Text Input
            </p>
            <pre className="whitespace-pre-wrap px-4 py-3 text-xs font-mono leading-relaxed max-h-72 overflow-y-auto" style={{ color: "var(--text-main)" }}>
              {rawText ?? "—"}
            </pre>
          </div>
          <div style={{ backgroundColor: "var(--bg-card)" }}>
            <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
              Structured Interpretation
            </p>
            <pre className="whitespace-pre-wrap px-4 py-3 text-xs font-mono leading-relaxed max-h-72 overflow-y-auto" style={{ color: "var(--text-main)" }}>
              {structured ? JSON.stringify(structured, null, 2) : "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
