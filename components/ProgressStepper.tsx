"use client";

import { useEffect, useState } from "react";

const STEPS = ["Parsing", "Profile Match", "Policy Check", "Scoring", "Decision"];

const STAGE_LABELS: Record<string, string> = {
  intake:     "Parsing request with Claude…",
  processing: "Running procurement pipeline…",
};

interface Props {
  stage: "intake" | "processing" | "done";
}

export default function ProgressStepper({ stage }: Props) {
  const [active, setActive] = useState(0);

  // Jump to all-done immediately when stage is done
  useEffect(() => {
    if (stage === "done") setActive(STEPS.length);
  }, [stage]);

  // Advance step by step while loading
  useEffect(() => {
    if (stage === "done" || active >= STEPS.length) return;
    const id = setTimeout(() => setActive((s) => s + 1), 620);
    return () => clearTimeout(id);
  }, [active, stage]);

  return (
    <div
      className="w-full max-w-2xl rounded-xl px-6 py-5"
      style={{ backgroundColor: "#12151f", border: "1px solid #1e2130" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-5"
        style={{ color: "#6b7280" }}
      >
        {stage === "done" ? "Complete" : (STAGE_LABELS[stage] ?? "Processing…")}
      </p>

      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const done    = i < active;
          const current = i === active && stage !== "done";

          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${current ? "animate-pulse" : ""}`}
                  style={{
                    backgroundColor: done || current ? "#dc2626" : "#1a1d27",
                    color: done || current ? "#fff" : "#374151",
                    border: done || current ? "none" : "1px solid #2a2f42",
                  }}
                >
                  {done ? (
                    <svg viewBox="0 0 12 12" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M10.28 2.28a.75.75 0 00-1.06 0L4.5 7l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l5.25-5.25a.75.75 0 000-1.06z" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className="text-xs whitespace-nowrap font-medium"
                  style={{ color: done ? "#dc2626" : current ? "#fff" : "#374151" }}
                >
                  {label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 mb-5 transition-colors duration-500"
                  style={{ backgroundColor: done ? "#dc2626" : "#1e2130" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
