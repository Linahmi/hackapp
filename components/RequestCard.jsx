function Field({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      <span className="text-sm text-zinc-800">{display}</span>
    </div>
  );
}

function Badge({ label }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      {label}
    </span>
  );
}

export default function RequestCard({ interpretation, confidence, requestId }) {
  if (!interpretation) return null;

  const {
    category_l1, category_l2, quantity, unit_of_measure, budget_amount, currency,
    delivery_countries, required_by_date, days_until_required, preferred_supplier_stated,
    incumbent_supplier, detected_language, gaps = [],
  } = interpretation;

  const confidenceColor =
    confidence >= 80 ? "text-green-600" : confidence >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">Request Interpretation</h2>
          {requestId && (
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-500">
              {requestId}
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold ${confidenceColor}`}>
          {confidence}% confidence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-3">
        <Field label="Category" value={`${category_l1} › ${category_l2}`} />
        <Field label="Quantity" value={quantity != null ? `${quantity} ${unit_of_measure ?? ""}`.trim() : null} />
        <Field label="Budget" value={budget_amount != null ? `${currency} ${Number(budget_amount).toLocaleString()}` : null} />
        <Field label="Delivery Countries" value={delivery_countries} />
        <Field label="Required By" value={required_by_date ? `${required_by_date}${days_until_required != null ? ` (${days_until_required}d)` : ""}` : null} />
        <Field label="Preferred Supplier" value={preferred_supplier_stated} />
        <Field label="Incumbent Supplier" value={incumbent_supplier} />
        <Field label="Language" value={detected_language?.toUpperCase()} />
      </div>

      {gaps.length > 0 && (
        <div className="border-t border-zinc-100 px-5 py-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">Missing Fields</p>
          <div className="flex flex-wrap gap-1.5">
            {gaps.map((g) => <Badge key={g} label={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}
