"use client";

interface AuditEvent {
  ts: string;
  text: string;
  detail?: string;
  status: "done" | "warning" | "critical" | "info";
}

const STATUS_CONFIG: Record<AuditEvent["status"], { bg: string; color: string; label: string }> = {
  done:     { bg: "rgba(34,197,94,0.10)",  color: "#86efac", label: "done" },
  warning:  { bg: "rgba(234,179,8,0.10)",  color: "#fde047", label: "warning" },
  critical: { bg: "rgba(220,38,38,0.12)",  color: "#fca5a5", label: "critical" },
  info:     { bg: "rgba(59,130,246,0.10)", color: "#93c5fd", label: "info" },
};

function fmtTs(baseMs: number, offsetMs: number): string {
  const d = new Date(baseMs - offsetMs);
  return d.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}

function deriveEvents(result: any): AuditEvent[] {
  const events: AuditEvent[] = [];

  const baseMs = result.audit_trail?.generated_at
    ? new Date(result.audit_trail.generated_at).getTime()
    : Date.now();

  const interp = result.request_interpretation ?? {};
  const issues = result.validation?.issues ?? [];
  const shortlist = result.supplier_shortlist ?? [];
  const excluded = result.suppliers_excluded ?? [];
  const escalations = result.escalations ?? [];
  const policiesChecked = result.audit_trail?.policies_checked ?? [];
  const confidence = result.confidence_score ?? null;
  const rec = result.recommendation;

  // 1. Request parsed
  const parsedDetail = [
    interp.category_l1,
    interp.category_l2,
    interp.quantity ? `${interp.quantity} ${interp.unit_of_measure ?? "units"}` : null,
    interp.currency && interp.budget_amount
      ? `budget ${interp.budget_amount.toLocaleString()} ${interp.currency}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  events.push({
    ts: fmtTs(baseMs, 5000),
    text: "Request parsed",
    detail: parsedDetail || undefined,
    status: "done",
  });

  // 2. Completeness validated
  const criticals = issues.filter((i: any) => i.severity === "critical");
  if (issues.length === 0) {
    events.push({
      ts: fmtTs(baseMs, 4200),
      text: "Rules validated",
      detail: "All required fields present — no gaps detected",
      status: "done",
    });
  } else {
    events.push({
      ts: fmtTs(baseMs, 4200),
      text: "Validation issues detected",
      detail: `${issues.length} issue${issues.length > 1 ? "s" : ""}: ${issues
        .map((i: any) => i.type.replace(/_/g, " "))
        .join(", ")}`,
      status: criticals.length > 0 ? "critical" : "warning",
    });
  }

  // 3. Policy rules applied
  if (policiesChecked.length > 0) {
    const shown = policiesChecked.slice(0, 5).join(", ");
    const more = policiesChecked.length > 5 ? ` +${policiesChecked.length - 5} more` : "";
    events.push({
      ts: fmtTs(baseMs, 3500),
      text: "Policy rules applied",
      detail: `${policiesChecked.length} rules evaluated: ${shown}${more}`,
      status: "done",
    });
  }

  // 4. Supplier shortlist computed
  if (shortlist.length > 0) {
    events.push({
      ts: fmtTs(baseMs, 2800),
      text: "Supplier shortlist computed",
      detail: `${shortlist.length} qualified · ${excluded.length} excluded · top: ${
        shortlist[0]?.supplier_name ?? "—"
      } (score ${shortlist[0]?.composite_score_pct ?? Math.round((shortlist[0]?.composite_score ?? 0) * 100)}%)`,
      status: "done",
    });
  } else {
    events.push({
      ts: fmtTs(baseMs, 2800),
      text: "No compliant supplier found",
      detail: "All candidates excluded by policy or scoring criteria",
      status: "critical",
    });
  }

  // 5. Confidence scoring
  if (confidence !== null) {
    const reduced =
      issues.length > 0 || escalations.some((e: any) => e.blocking);
    events.push({
      ts: fmtTs(baseMs, 2100),
      text: reduced
        ? "Confidence reduced due to conflict"
        : "Confidence score computed",
      detail: `${confidence}% overall confidence`,
      status: reduced ? "warning" : "done",
    });
  }

  // 6. Escalation
  if (escalations.length > 0) {
    const blocking = escalations.filter((e: any) => e.blocking);
    const approvers = [
      ...new Set(escalations.map((e: any) => e.escalate_to).filter(Boolean)),
    ] as string[];
    events.push({
      ts: fmtTs(baseMs, 1400),
      text: "Escalation required",
      detail: `${blocking.length} blocking · route to: ${
        approvers.join(", ") || "—"
      }`,
      status: blocking.length > 0 ? "critical" : "warning",
    });
  }

  // 7. Decision generated
  if (rec) {
    const statusLabel: Record<string, string> = {
      approved: "Auto-approved",
      pending_approval: "Pending approval",
      cannot_proceed: "Cannot proceed",
    };
    events.push({
      ts: fmtTs(baseMs, 700),
      text: "Decision generated",
      detail: [
        statusLabel[rec.status] ?? rec.status,
        rec.recommended_supplier,
      ]
        .filter(Boolean)
        .join(" · "),
      status:
        rec.status === "approved"
          ? "done"
          : rec.status === "cannot_proceed"
          ? "critical"
          : "warning",
    });
  }

  // 8. Audit logged
  const sources = result.audit_trail?.data_sources_used ?? [];
  events.push({
    ts: fmtTs(baseMs, 100),
    text: "Audit logged",
    detail: [
      sources.length > 0 ? `${sources.length} data sources` : null,
      result.request_id ?? null,
      result.processed_at
        ? `at ${new Date(result.processed_at).toISOString().replace("T", " ").substring(0, 19)} UTC`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    status: "done",
  });

  return events;
}

interface Props {
  result: any;
}

export default function AuditTrail({ result }: Props) {
  if (!result) return null;

  const events = deriveEvents(result);

  return (
    <div
      className="w-full max-w-2xl rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-card)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid var(--border-card)" }}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            style={{ color: "var(--text-muted)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Audit Trail
          </span>
        </div>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {events.length} events
        </span>
      </div>

      {/* Events */}
      <div className="flex flex-col">
        {events.map((ev, i) => {
          const cfg = STATUS_CONFIG[ev.status];
          const isLast = i === events.length - 1;
          return (
            <div
              key={i}
              className="flex items-start gap-4 px-5 py-3"
              style={
                !isLast
                  ? { borderBottom: "1px solid var(--border-subtle)" }
                  : undefined
              }
            >
              {/* Timestamp */}
              <span
                className="shrink-0 text-[10px] font-mono pt-[2px]"
                style={{ color: "var(--text-muted)", minWidth: "152px" }}
              >
                {ev.ts}
              </span>

              {/* Event text + detail */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span
                  className="text-sm font-medium leading-snug"
                  style={{ color: "var(--text-main)" }}
                >
                  {ev.text}
                </span>
                {ev.detail && (
                  <span
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {ev.detail}
                  </span>
                )}
              </div>

              {/* Status badge */}
              <span
                className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
