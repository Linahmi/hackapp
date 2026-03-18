import { getHistoricalAwards } from "./dataLoader.js";

/**
 * Build the audit trail for a processed request.
 */
export function buildAuditTrail(request, policyEvaluation, shortlist, excluded) {
  const { category_l1, category_l2, delivery_countries = [] } = request;

  const policiesChecked = [
    policyEvaluation.approval_threshold?.rule_applied,
    ...policyEvaluation.category_rules_applied.map((r) => r.rule_id),
    ...policyEvaluation.geography_rules_applied.map((r) => r.rule_id),
  ].filter(Boolean);

  // Add escalation rules referenced
  const allIdsSet = new Set(policiesChecked);
  if (!allIdsSet.has("ER-001")) policiesChecked.push("ER-001");

  const supplierIds = [
    ...shortlist.map((s) => s.supplier_id),
    ...excluded.map((s) => s.supplier_id),
  ];

  const historicalAwards = getHistoricalAwards(
    category_l1,
    category_l2,
    delivery_countries[0] ?? ""
  );

  let historicalNote = null;
  if (historicalAwards.length > 0) {
    const awarded = historicalAwards.filter((a) => a.awarded === true || a.awarded === "True");
    if (awarded.length > 0) {
      const ids = historicalAwards.map((a) => a.award_id).join(", ");
      const prevWinner = awarded[0];
      historicalNote = `${ids} show prior awards in this category/country. Most recent winner: ${prevWinner.supplier_name} at ${prevWinner.currency} ${Number(prevWinner.total_value).toLocaleString()}. Used for pattern context only.`;
    }
  }

  return {
    policies_checked: [...new Set(policiesChecked)],
    supplier_ids_evaluated: [...new Set(supplierIds)],
    pricing_tiers_applied: shortlist.map((s) => s.pricing_tier_applied).join(", ") || "none",
    data_sources_used: ["requests.json", "suppliers.csv", "pricing.csv", "policies.json"],
    historical_awards_consulted: historicalAwards.length > 0,
    historical_award_note: historicalNote,
  };
}
