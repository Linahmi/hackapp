"use client";

import { useEffect, useState } from "react";

// Must match the 5 pipeline stages described in the spec
const STEPS = ["Parsing", "Rules Check", "Scoring", "Decision", "Logged"];

interface Props {
  stage: "intake" | "processing" | "done";
}

export default function ProgressStepper({ stage }: Props) {
  // `active` = number of steps fully completed (shown with checkmark)
  // step[active] is the current/pulsing step (if stage !== "done")
  const [active, setActive] = useState(0);

  // Snap to terminal states or reset when stage changes
  useEffect(() => {
    if (stage === "done") {
      setActive(STEPS.length); // all done
    } else if (stage === "intake") {
      setActive(0); // hold on Parsing
    } else if (stage === "processing") {
      setActive(1); // Parsing done, Rules Check now active
    }
  }, [stage]);

  // During "processing": advance one step every 600 ms until near the end
  useEffect(() => {
    if (stage !== "processing") return;
    // Don't go past step 3 (Decision) — let backend response flip to done
    if (active >= STEPS.length - 1) return;
    const id = setTimeout(() => setActive((s) => s + 1), 600);
    return () => clearTimeout(id);
  }, [active, stage]);

  const headerLabel =
    stage === "done"
      ? "Pipeline complete"
      : stage === "intake"
      ? "Parsing request…"
      : "Running procurement pipeline…";

  return (
    <div
      className="w-full max-w-2xl rounded-xl px-6 py-5"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-card)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest mb-5"
        style={{ color: "var(--text-muted)" }}
      >
        {headerLabel}
      </p>

      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < active;
          const current = i === active && stage !== "done";

          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                {/* Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    current ? "animate-pulse" : ""
                  }`}
                  style={{
                    backgroundColor: done
                      ? "#dc2626"
                      : current
                      ? "rgba(220,38,38,0.45)"
                      : "var(--bg-hover)",
                    color:
                      done || current ? "var(--text-main)" : "var(--text-muted)",
                    border:
                      done || current ? "none" : "1px solid #2a2f42",
                  }}
                >
                  {done ? (
                    <svg
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      className="w-3.5 h-3.5"
                    >
                      <path d="M10.28 2.28a.75.75 0 00-1.06 0L4.5 7l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l5.25-5.25a.75.75 0 000-1.06z" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span
                  className="text-xs whitespace-nowrap font-medium"
                  style={{
                    color: done
                      ? "#dc2626"
                      : current
                      ? "var(--text-main)"
                      : "var(--text-muted)",
                  }}
                >
                  {label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 mb-5 transition-colors duration-500"
                  style={{
                    backgroundColor: done ? "#dc2626" : "#1e2130",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
