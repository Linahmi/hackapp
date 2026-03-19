"use client";

import { useState } from "react";

type Escalation = {
  escalation_id: string;
  rule: string;
  trigger: string;
  escalate_to: string;
  hierarchy_level: number;
  hierarchy_label: string;
  hierarchy_color: string;
  blocking: boolean;
  action: string;
  estimated_savings?: number | null;
};

type Props = {
  escalations: Escalation[];
  currency?: string;
};

const LEVEL_META: Record<number, { icon: string; description: string }> = {
  1: { icon: "✎", description: "Input correction required" },
  2: { icon: "◈", description: "Self-approval" },
  3: { icon: "◉", description: "Procurement review" },
  4: { icon: "▲", description: "Category governance" },
  5: { icon: "◆", description: "Strategic sourcing" },
  6: { icon: "★", description: "Executive sign-off" },
};

export function EscalationHierarchyPanel({ escalations, currency = "EUR" }: Props) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  if (!escalations || escalations.length === 0) return null;

  const blocking = escalations.filter(e => e.blocking);
  const nonBlocking = escalations.filter(e => !e.blocking);

  // All unique levels involved, sorted senior → junior
  const levelMap = new Map<number, { label: string; color: string; escalations: Escalation[] }>();
  for (const e of escalations) {
    if (!levelMap.has(e.hierarchy_level)) {
      levelMap.set(e.hierarchy_level, { label: e.hierarchy_label, color: e.hierarchy_color, escalations: [] });
    }
    levelMap.get(e.hierarchy_level)!.escalations.push(e);
  }
  const levels = Array.from(levelMap.entries()).sort((a, b) => b[0] - a[0]);

  function markSent(id: string) {
    setSentIds(prev => new Set([...prev, id]));
  }

  return (
    <div className="mt-4 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
            Approval hierarchy
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {blocking.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-red-900/30 text-red-400 border border-red-800/40">
              {blocking.length} blocking
            </span>
          )}
          {nonBlocking.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-900/20 text-amber-400 border border-amber-800/30">
              {nonBlocking.length} informational
            </span>
          )}
        </div>
      </div>

      {/* Chain */}
      <div className="px-5 py-5 flex flex-col gap-0">
        {levels.map(([level, { label, color, escalations: levelEscs }], idx) => {
          const meta = LEVEL_META[level] ?? { icon: "●", description: "" };
          const isLast = idx === levels.length - 1;
          const allSent = levelEscs.every(e => sentIds.has(e.escalation_id));

          return (
            <div key={level} className="flex gap-3">
              {/* Vertical line + node */}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border"
                  style={{ backgroundColor: `${color}20`, borderColor: `${color}50`, color }}
                >
                  {meta.icon}
                </div>
                {!isLast && (
                  <div className="w-px flex-1 my-1" style={{ backgroundColor: `${color}30`, minHeight: "16px" }} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : "pb-0"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold" style={{ color }}>L{level}</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{label}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>— {meta.description}</span>
                  {allSent && (
                    <span className="ml-auto text-xs text-emerald-400 font-semibold">✓ Notified</span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {levelEscs.map(e => {
                    const sent = sentIds.has(e.escalation_id);
                    return (
                      <div
                        key={e.escalation_id}
                        className="rounded-lg px-4 py-3 transition-all"
                        style={{
                          backgroundColor: e.blocking ? `rgba(239,68,68,0.06)` : `rgba(245,158,11,0.06)`,
                          border: `1px solid ${e.blocking ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
                          borderLeft: `3px solid ${e.blocking ? "#EF4444" : "#F59E0B"}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: e.blocking ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                                  color: e.blocking ? "#FCA5A5" : "#FCD34D",
                                }}
                              >
                                {e.blocking ? "BLOCKING" : "INFO"}
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{e.rule} · {e.escalation_id}</span>
                            </div>
                            <p className="text-sm leading-snug mb-1.5" style={{ color: "var(--text-main)" }}>{e.trigger}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                              <span className="font-semibold text-emerald-400/80">Required action: </span>
                              {e.action}
                            </p>
                          </div>

                          {/* Send button */}
                          <button
                            onClick={() => markSent(e.escalation_id)}
                            disabled={sent}
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                            style={sent
                              ? { backgroundColor: "rgba(16,185,129,0.12)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.3)", cursor: "default" }
                              : { backgroundColor: `${color}20`, color, border: `1px solid ${color}40`, cursor: "pointer" }
                            }
                          >
                            {sent ? "✓ Sent" : `Notify ${label}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="px-5 py-3 border-t text-xs flex items-center justify-between" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
        <span>
          {blocking.length > 0
            ? `Cannot proceed until ${blocking.length} blocking escalation${blocking.length > 1 ? "s are" : " is"} resolved`
            : "All escalations are informational — can proceed in parallel"}
        </span>
        <span className="font-mono">{levels.length} level{levels.length > 1 ? "s" : ""} involved</span>
      </div>
    </div>
  );
}
