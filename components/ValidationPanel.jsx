const SEVERITY_STYLES = {
  critical: "bg-red-50 border-red-200 text-red-800",
  high:     "bg-orange-50 border-orange-200 text-orange-800",
  medium:   "bg-amber-50 border-amber-200 text-amber-800",
  low:      "border-l-4",
};

const SEVERITY_BADGE = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      null,
};

export default function ValidationPanel({ validation }) {
  if (!validation) return null;
  const { completeness, issues_detected = [] } = validation;
  const pass = completeness === "pass";

  return (
    <div className="rounded-xl shadow-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Validation</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            pass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {pass ? "Pass" : "Fail"}
        </span>
      </div>

      {issues_detected.length === 0 ? (
        <p className="px-5 py-4 text-sm" style={{ color: "var(--text-muted)" }}>No issues detected.</p>
      ) : (
        <ul>
          {issues_detected.map((issue) => {
            const isLow = issue.severity === "low" || !SEVERITY_STYLES[issue.severity];
            return (
              <li
                key={issue.issue_id}
                className={`border-l-4 px-5 py-4 ${isLow ? "" : SEVERITY_STYLES[issue.severity]}`}
                style={
                  isLow
                    ? { backgroundColor: "var(--bg-card)", borderLeftColor: "var(--border-card)", borderBottom: "1px solid var(--border-subtle)" }
                    : { borderBottom: "1px solid var(--border-subtle)" }
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{issue.issue_id}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                          SEVERITY_BADGE[issue.severity] ?? ""
                        }`}
                        style={!SEVERITY_BADGE[issue.severity] ? { backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" } : {}}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{issue.type}</span>
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-main)" }}>{issue.description}</p>
                    {issue.action_required && (
                      <p className="mt-1 text-xs opacity-80" style={{ color: "var(--text-muted)" }}>→ {issue.action_required}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
