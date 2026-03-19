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

type RecipientMeta = { name: string; dept: string; action: string; responseTime: string; responseEmoji: string };

const RULE_RECIPIENTS: Array<{ pattern: RegExp } & RecipientMeta> = [
  {
    pattern: /budget/i,
    name: "Procurement Manager", dept: "Sourcing Team",
    action: "Review budget gap with requester and negotiate revised quantity or budget increase.",
    responseTime: "Response needed within 24–48 hours", responseEmoji: "📋",
  },
  {
    pattern: /restrict|compliance|sanction|legal/i,
    name: "Compliance Team", dept: "Legal & Risk",
    action: "Verify supplier restriction status and approve exception if justified.",
    responseTime: "Response needed within 4 hours", responseEmoji: "⚡",
  },
  {
    pattern: /lead.?time|delivery|timeline|feasib/i,
    name: "Category Manager", dept: "IT Procurement",
    action: "Identify emergency sourcing options or negotiate deadline extension with requester.",
    responseTime: "Response needed within 4 hours", responseEmoji: "⚡",
  },
  {
    pattern: /missing|incomplete|info|detail|unknown/i,
    name: "Sourcing Agent", dept: "Procurement",
    action: "Contact requester to collect missing fields before resubmission.",
    responseTime: "Contact requester today", responseEmoji: "📞",
  },
  {
    pattern: /no.?supplier|supplier.?not.?found|unavailable|no.?vendor/i,
    name: "Head of Category", dept: "Regional Sourcing",
    action: "Expand supplier search to alternative regions or approve new vendor onboarding.",
    responseTime: "Response needed within 4 hours", responseEmoji: "⚡",
  },
];

function getRecipient(rule: string, trigger: string): RecipientMeta | null {
  const text = `${rule} ${trigger}`;
  return RULE_RECIPIENTS.find(r => r.pattern.test(text)) ?? null;
}

export function EscalationHierarchyPanel({ escalations }: Props) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sentTimes, setSentTimes] = useState<Record<string, string>>({});
  const [auditLog, setAuditLog] = useState<string[]>([]);

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

  function markSent(id: string, recipientLabel: string) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString([], { month: "short", day: "numeric" });
    setSentIds(prev => new Set([...prev, id]));
    setSentTimes(prev => ({ ...prev, [id]: timeStr }));
    setAuditLog(prev => [...prev, `Escalated to ${recipientLabel} at ${dateStr} ${timeStr}`]);
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
                    const sentTime = sentTimes[e.escalation_id];
                    const recipient = getRecipient(e.rule, e.trigger);
                    // Fallback response time: blocking = 4h, informational = 24-48h
                    const fallbackResponseTime = e.blocking
                      ? "Response needed within 4 hours"
                      : "Response needed within 24–48 hours";
                    const fallbackEmoji = e.blocking ? "⚡" : "📋";
                    const displayName = recipient?.name ?? label;
                    const displayDept = recipient?.dept ?? null;
                    const displayAction = recipient?.action ?? e.action;
                    const displayResponseTime = recipient?.responseTime ?? fallbackResponseTime;
                    const displayEmoji = recipient?.responseEmoji ?? fallbackEmoji;
                    const recipientLabel = displayDept ? `${displayName} (${displayDept})` : displayName;

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

                            {/* WHO · WHAT · WHEN */}
                            <div className="flex flex-col gap-1.5 mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              {/* WHO */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Recipient</span>
                                <span
                                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold"
                                  style={{
                                    backgroundColor: e.blocking ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                                    color: e.blocking ? "#FCA5A5" : "#FCD34D",
                                    border: `1px solid ${e.blocking ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                                  }}
                                >
                                  {displayName}
                                  {displayDept && (
                                    <span className="font-normal opacity-75"> · {displayDept}</span>
                                  )}
                                </span>
                              </div>

                              {/* WHAT */}
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                <span style={{ color: "var(--text-main)", fontWeight: 600 }}>Action: </span>
                                {displayAction}
                              </p>

                              {/* WHEN */}
                              <span
                                className="text-xs font-semibold"
                                style={{ color: e.blocking ? "#FCA5A5" : "#FCD34D" }}
                              >
                                {displayEmoji} {displayResponseTime}
                              </span>
                            </div>
                          </div>

                          {/* Send Notification button */}
                          <button
                            onClick={() => !sent && markSent(e.escalation_id, recipientLabel)}
                            disabled={sent}
                            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
                            style={sent
                              ? { backgroundColor: "rgba(16,185,129,0.12)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.3)", cursor: "default" }
                              : { backgroundColor: `${color}20`, color, border: `1px solid ${color}40`, cursor: "pointer" }
                            }
                          >
                            {sent ? `✓ Notified at ${sentTime}` : "Send Notification"}
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

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div className="px-5 py-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Audit trail</p>
          <div className="flex flex-col gap-0.5">
            {auditLog.map((entry, i) => (
              <p key={i} className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>▸ {entry}</p>
            ))}
          </div>
        </div>
      )}

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
