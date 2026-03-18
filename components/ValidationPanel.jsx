const SEVERITY_STYLES = {
  critical: "bg-red-50 border-red-200 text-red-800",
  high:     "bg-orange-50 border-orange-200 text-orange-800",
  medium:   "bg-amber-50 border-amber-200 text-amber-800",
  low:      "bg-zinc-50 border-zinc-200 text-zinc-700",
};

const SEVERITY_BADGE = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-zinc-100 text-zinc-600",
};

export default function ValidationPanel({ validation }) {
  if (!validation) return null;
  const { completeness, issues_detected = [] } = validation;
  const pass = completeness === "pass";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">Validation</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            pass ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {pass ? "Pass" : "Fail"}
        </span>
      </div>

      {issues_detected.length === 0 ? (
        <p className="px-5 py-4 text-sm text-zinc-500">No issues detected.</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {issues_detected.map((issue) => (
            <li
              key={issue.issue_id}
              className={`border-l-4 px-5 py-4 ${SEVERITY_STYLES[issue.severity] ?? SEVERITY_STYLES.low}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-zinc-400">{issue.issue_id}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        SEVERITY_BADGE[issue.severity] ?? SEVERITY_BADGE.low
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <span className="text-xs text-zinc-500">{issue.type}</span>
                  </div>
                  <p className="text-sm">{issue.description}</p>
                  {issue.action_required && (
                    <p className="mt-1 text-xs opacity-80">→ {issue.action_required}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
