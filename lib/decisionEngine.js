/**
 * Make the final procurement recommendation.
 * Returns { status, reason, preferred_supplier_if_resolved, preferred_supplier_rationale, minimum_budget_required, minimum_budget_currency }
 */
export function makeDecision(validation, policyEvaluation, shortlist, escalations, request) {
  const blockingEscalations = escalations.filter((e) => e.blocking);
  const { currency = "EUR", quantity } = request;

  if (blockingEscalations.length > 0) {
    const topSupplier = shortlist[0] ?? null;
    const minBudget = topSupplier ? topSupplier.total_price : null;

    return {
      status: "cannot_proceed",
      reason: `${blockingEscalations.length} blocking issue${blockingEscalations.length > 1 ? "s" : ""} prevent autonomous award: ${blockingEscalations.map((e) => e.trigger).join("; ")}`,
      preferred_supplier_if_resolved: topSupplier?.supplier_name ?? null,
      preferred_supplier_rationale: topSupplier
        ? `${topSupplier.supplier_name} is ranked #1 with composite score ${topSupplier.composite_score} (${topSupplier.incumbent ? "incumbent, " : ""}total ${currency} ${topSupplier.total_price?.toLocaleString()}).`
        : "No compliant supplier found.",
      minimum_budget_required: minBudget,
      minimum_budget_currency: minBudget ? currency : null,
    };
  }

  if (shortlist.length === 0) {
    return {
      status: "cannot_proceed",
      reason: "No compliant supplier found for this category and country combination.",
      preferred_supplier_if_resolved: null,
      preferred_supplier_rationale: null,
      minimum_budget_required: null,
      minimum_budget_currency: null,
    };
  }

  const top = shortlist[0];
  const quotesRequired = policyEvaluation.approval_threshold?.quotes_required ?? 1;
  const hasEnoughQuotes = shortlist.length >= quotesRequired;

  if (!hasEnoughQuotes) {
    return {
      status: "pending_approval",
      reason: `Policy requires ${quotesRequired} supplier quotes; only ${shortlist.length} compliant supplier(s) found.`,
      preferred_supplier_if_resolved: top.supplier_name,
      preferred_supplier_rationale: `${top.supplier_name} is the top-ranked compliant option.`,
      minimum_budget_required: null,
      minimum_budget_currency: null,
    };
  }

  const nonBlockingEscalations = escalations.filter((e) => !e.blocking);
  if (nonBlockingEscalations.length > 0) {
    return {
      status: "pending_approval",
      reason: `${nonBlockingEscalations.length} non-blocking review(s) required before award: ${nonBlockingEscalations.map((e) => e.escalate_to).join(", ")}.`,
      recommended_supplier: top.supplier_name,
      recommended_supplier_rationale: `${top.supplier_name} ranks #1 with composite score ${top.composite_score}. ${top.recommendation_note}`,
      minimum_budget_required: null,
      minimum_budget_currency: null,
    };
  }

  return {
    status: "approved",
    reason: "All policy checks passed. Sufficient quotes obtained.",
    recommended_supplier: top.supplier_name,
    recommended_supplier_rationale: `${top.supplier_name} ranks #1 with composite score ${top.composite_score}. ${top.recommendation_note}`,
    minimum_budget_required: null,
    minimum_budget_currency: null,
  };
}
