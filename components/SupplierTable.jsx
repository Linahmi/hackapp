function Score({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 45 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">{pct}%</span>
    </div>
  );
}

function Tag({ label, variant = "default" }) {
  const styles = {
    preferred: "bg-indigo-50 text-indigo-700",
    incumbent: "bg-green-50 text-green-700",
    default:   "bg-zinc-100 text-zinc-500",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[variant] ?? styles.default}`}>
      {label}
    </span>
  );
}

export default function SupplierTable({ shortlist = [], excluded = [], currency = "EUR" }) {
  if (shortlist.length === 0 && excluded.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">
          Supplier Shortlist
          <span className="ml-2 text-xs font-normal text-zinc-400">{shortlist.length} ranked</span>
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-2 w-8">#</th>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2 text-right">Unit Price</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Lead Time</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2 text-right">Q / R / E</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {shortlist.map((s) => (
              <tr key={s.supplier_id} className="hover:bg-zinc-50/50">
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{s.rank}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-zinc-800">{s.supplier_name}</span>
                    <div className="flex flex-wrap gap-1">
                      {s.preferred && <Tag label="preferred" variant="preferred" />}
                      {s.incumbent && <Tag label="incumbent" variant="incumbent" />}
                    </div>
                    {s.recommendation_note && (
                      <span className="text-xs text-zinc-400 leading-tight">{s.recommendation_note}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                  {s.currency ?? currency} {Number(s.unit_price).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-800">
                  {s.currency ?? currency} {Number(s.total_price).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{s.standard_lead_time_days}d std</span>
                    <span className="text-xs text-zinc-400">{s.expedited_lead_time_days}d exp</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Score value={s.composite_score} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs text-zinc-500">
                  {s.quality_score} / {s.risk_score} / {s.esg_score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {excluded.length > 0 && (
        <div className="border-t border-zinc-100 px-5 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Excluded</p>
          <ul className="space-y-1">
            {excluded.map((e) => (
              <li key={e.supplier_id} className="flex items-start gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">{e.supplier_name}</span>
                <span>—</span>
                <span>{e.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
