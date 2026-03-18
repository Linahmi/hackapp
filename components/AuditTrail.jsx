export default function AuditTrail({ auditTrail, processedAt }) {
  if (!auditTrail) return null;

  const {
    policies_checked = [],
    supplier_ids_evaluated = [],
    pricing_tiers_applied,
    data_sources_used = [],
    historical_awards_consulted,
    historical_award_note,
  } = auditTrail;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">Audit Trail</h2>
      </div>

      <div className="grid grid-cols-1 gap-px bg-zinc-100 sm:grid-cols-2">
        <Row label="Policies Checked">
          <Tags items={policies_checked} color="blue" />
        </Row>
        <Row label="Suppliers Evaluated">
          <Tags items={supplier_ids_evaluated} color="zinc" />
        </Row>
        <Row label="Pricing Tiers Applied">
          <p className="text-sm text-zinc-700">{pricing_tiers_applied || "—"}</p>
        </Row>
        <Row label="Data Sources">
          <Tags items={data_sources_used} color="zinc" />
        </Row>
        <Row label="Historical Awards" className="sm:col-span-2">
          <p className="text-sm text-zinc-700">
            {historical_awards_consulted ? historical_award_note ?? "Consulted." : "Not consulted."}
          </p>
        </Row>
        {processedAt && (
          <Row label="Processed At" className="sm:col-span-2">
            <p className="text-sm text-zinc-700 font-mono">{processedAt}</p>
          </Row>
        )}
      </div>
    </div>
  );
}

function Row({ label, children, className = "" }) {
  return (
    <div className={`bg-white px-5 py-3 ${className}`}>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      {children}
    </div>
  );
}

function Tags({ items, color = "zinc" }) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    zinc: "bg-zinc-100 text-zinc-600",
  };
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className={`rounded px-1.5 py-0.5 text-xs font-mono font-medium ${styles[color] ?? styles.zinc}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
