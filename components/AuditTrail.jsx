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
    <div className="rounded-xl shadow-sm" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-card)" }}>
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Audit Trail</h2>
      </div>

      <div className="grid grid-cols-1 gap-px sm:grid-cols-2" style={{ backgroundColor: "var(--border-subtle)" }}>
        <Row label="Policies Checked">
          <Tags items={policies_checked} color="blue" />
        </Row>
        <Row label="Suppliers Evaluated">
          <Tags items={supplier_ids_evaluated} color="muted" />
        </Row>
        <Row label="Pricing Tiers Applied">
          <p className="text-sm" style={{ color: "var(--text-main)" }}>{pricing_tiers_applied || "—"}</p>
        </Row>
        <Row label="Data Sources">
          <Tags items={data_sources_used} color="muted" />
        </Row>
        <Row label="Historical Awards" className="sm:col-span-2">
          <p className="text-sm" style={{ color: "var(--text-main)" }}>
            {historical_awards_consulted ? historical_award_note ?? "Consulted." : "Not consulted."}
          </p>
        </Row>
        {processedAt && (
          <Row label="Processed At" className="sm:col-span-2">
            <p className="text-sm font-mono" style={{ color: "var(--text-main)" }}>{processedAt}</p>
          </Row>
        )}
      </div>
    </div>
  );
}

function Row({ label, children, className = "" }) {
  return (
    <div className={`px-5 py-3 ${className}`} style={{ backgroundColor: "var(--bg-card)" }}>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

function Tags({ items, color = "muted" }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="rounded px-1.5 py-0.5 text-xs font-mono font-medium"
          style={
            color === "blue"
              ? { backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6" }
              : { backgroundColor: "var(--bg-hover)", color: "var(--text-muted)" }
          }
        >
          {item}
        </span>
      ))}
    </div>
  );
}
