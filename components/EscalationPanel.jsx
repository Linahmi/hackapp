export default function EscalationPanel({ escalations = [] }) {
  if (escalations.length === 0) return null;

  const blocking = escalations.filter((e) => e.blocking);
  const nonBlocking = escalations.filter((e) => !e.blocking);

  return (
    <div className="rounded-xl shadow-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Escalations</h2>
        <div className="flex gap-2">
          {blocking.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              {blocking.length} blocking
            </span>
          )}
          {nonBlocking.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {nonBlocking.length} advisory
            </span>
          )}
        </div>
      </div>

      <ul style={{ borderTop: "none" }}>
        {escalations.map((e) => (
          <li key={e.escalation_id} className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  e.blocking ? "bg-red-500" : "bg-amber-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{e.escalation_id}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" }}
                  >
                    {e.rule}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      e.blocking
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {e.blocking ? "Blocking" : "Advisory"}
                  </span>
                </div>
                <p className="text-sm" style={{ color: "var(--text-main)" }}>{e.trigger}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                  Escalate to: <span className="font-medium" style={{ color: "var(--text-main)" }}>{e.escalate_to}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
