export default function EscalationPanel({ escalations = [] }) {
  if (escalations.length === 0) return null;

  const blocking = escalations.filter((e) => e.blocking);
  const nonBlocking = escalations.filter((e) => !e.blocking);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">Escalations</h2>
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

      <ul className="divide-y divide-zinc-50">
        {escalations.map((e) => (
          <li key={e.escalation_id} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  e.blocking ? "bg-red-500" : "bg-amber-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-400">{e.escalation_id}</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
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
                <p className="text-sm text-zinc-700">{e.trigger}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Escalate to: <span className="font-medium text-zinc-600">{e.escalate_to}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
