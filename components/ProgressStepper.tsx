"use client";

const STEPS = [
  { id: "parsing",  label: "Parsing" },
  { id: "rules",    label: "Rules Check" },
  { id: "scoring",  label: "Scoring" },
  { id: "decision", label: "Decision" },
  { id: "logged",   label: "Logged" },
];

type PipelineStatus = "complete" | "awaiting_action" | "pending_resolution";

const STATUS_CFG: Record<PipelineStatus, { label: string; color: string; pct: number }> = {
  complete:            { label: "Pipeline complete",    color: "#22c55e", pct: 100 },
  awaiting_action:     { label: "Awaiting action",      color: "#f59e0b", pct: 85  },
  pending_resolution:  { label: "Pending resolution",   color: "#ef4444", pct: 85  },
};

interface Props {
  activeStep: number;
  thinkingText?: string;
  done?: boolean;
  pct?: number;
  pipelineStatus?: PipelineStatus;
}

export default function ProgressStepper({ activeStep, thinkingText, done, pct, pipelineStatus }: Props) {
  const statusCfg = pipelineStatus ? STATUS_CFG[pipelineStatus] : null;

  const percentage = statusCfg
    ? statusCfg.pct
    : done
    ? 100
    : (pct ?? Math.round((activeStep / STEPS.length) * 100));

  const barColor = statusCfg ? statusCfg.color : done ? "#22c55e" : "#dc2626";

  const headerLabel = statusCfg
    ? statusCfg.label
    : done
    ? "Pipeline complete"
    : activeStep === 0
    ? "Parsing request…"
    : "Running procurement pipeline…";

  return (
    <div
      className="w-full max-w-2xl rounded-xl px-6 py-5 no-print"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-card)",
      }}
    >
      {/* Header with percentage */}
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          {headerLabel}
        </p>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: barColor }}
        >
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full mb-5 overflow-hidden"
        style={{ backgroundColor: "var(--bg-hover)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      {/* Step circles */}
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const isDone = i < activeStep || done;
          const isCurrent = i === activeStep && !done;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    isCurrent ? "animate-pulse" : ""
                  }`}
                  style={{
                    backgroundColor: isDone
                      ? "#dc2626"
                      : isCurrent
                      ? "rgba(220,38,38,0.45)"
                      : "var(--bg-hover)",
                    color: isDone || isCurrent ? "var(--text-main)" : "var(--text-muted)",
                    border: isDone || isCurrent ? "none" : "1px solid var(--border-card)",
                  }}
                >
                  {isDone ? (
                    <svg viewBox="0 0 12 12" fill="currentColor" className="w-3.5 h-3.5">
                      <path d="M10.28 2.28a.75.75 0 00-1.06 0L4.5 7l-1.72-1.72a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l5.25-5.25a.75.75 0 000-1.06z" />
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className="text-xs whitespace-nowrap font-medium"
                  style={{
                    color: isDone
                      ? "#dc2626"
                      : isCurrent
                      ? "var(--text-main)"
                      : "var(--text-muted)",
                  }}
                >
                  {step.label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 mb-5 transition-colors duration-500"
                  style={{
                    backgroundColor: isDone ? "#dc2626" : "var(--border-card)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* AI Thinking Text */}
      {thinkingText && (
        <div
          className="mt-4 pt-4 flex items-start gap-2.5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {!done && (
            <div className="mt-0.5 flex gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {thinkingText}
          </p>
        </div>
      )}
    </div>
  );
}
