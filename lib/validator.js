import { getEligibleSuppliers } from "./dataLoader.js";

/**
 * Validate a structured intake request.
 * Returns { completeness, issues }
 */
export function validate(request, eligibleSuppliers) {
  const issues = [];
  let issueCounter = 1;
  const id = () => `V-${String(issueCounter++).padStart(3, "0")}`;

  const {
    quantity,
    budget_amount,
    currency,
    required_by_date,
    delivery_countries = [],
    preferred_supplier_mentioned,
    scenario_tags = [],
    gaps = [],
    days_until_required,
  } = request;

  // --- Completeness gaps ---
  for (const gap of gaps) {
    issues.push({
      issue_id: id(),
      severity: "medium",
      type: "missing_field",
      description: `Field '${gap}' could not be extracted from the request text.`,
      action_required: `Requester should clarify: ${gap}.`,
    });
  }

  // --- Budget feasibility ---
  if (budget_amount != null && quantity != null && eligibleSuppliers.length > 0) {
    const minUnitPrice = Math.min(...eligibleSuppliers.map((e) => Number(e.tier.unit_price)));
    const minTotal = minUnitPrice * quantity;
    if (budget_amount < minTotal) {
      const maxAffordable = Math.floor(budget_amount / minUnitPrice);
      issues.push({
        issue_id: id(),
        severity: "critical",
        type: "budget_insufficient",
        description: `Budget of ${currency} ${budget_amount.toLocaleString()} cannot cover ${quantity} units. Lowest available unit price is ${currency} ${minUnitPrice.toFixed(2)} (total ${currency} ${minTotal.toFixed(2)} — ${currency} ${(minTotal - budget_amount).toFixed(2)} over budget).`,
        action_required: `Requester must either increase budget to at least ${currency} ${minTotal.toFixed(2)} or reduce quantity to a maximum of ${maxAffordable} units.`,
      });
    }
  }

  // --- Lead time feasibility ---
  if (required_by_date != null && days_until_required != null && eligibleSuppliers.length > 0) {
    const minExpedited = Math.min(...eligibleSuppliers.map((e) => Number(e.tier.expedited_lead_time_days)));
    const minStandard = Math.min(...eligibleSuppliers.map((e) => Number(e.tier.standard_lead_time_days)));
    if (minExpedited > days_until_required) {
      issues.push({
        issue_id: id(),
        severity: "high",
        type: "lead_time_infeasible",
        description: `Required delivery date ${required_by_date} is ${days_until_required} days from now. All suppliers' expedited lead times are ${minExpedited}–${minStandard} days. No compliant supplier can meet the stated deadline.`,
        action_required: `Requester must confirm whether the delivery date is a hard constraint. If so, no compliant supplier can meet it and an escalation is required.`,
      });
    }
  }

  // --- Single-source policy conflict ---
  const hasSingleSourceInstruction = scenario_tags.includes("single_source") ||
    (preferred_supplier_mentioned && scenario_tags.includes("contradictory"));
  if (hasSingleSourceInstruction) {
    issues.push({
      issue_id: id(),
      severity: "high",
      type: "policy_conflict",
      description: `Requester instruction implies single-supplier selection, which may conflict with procurement policy requiring multiple quotes above spending thresholds.`,
      action_required: `Verify approval threshold. If contract value exceeds the single-quote threshold, policy requires additional supplier quotes. A requester cannot waive this unilaterally.`,
    });
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const completeness = gaps.length === 0 && !hasCritical ? "pass" : "fail";

  return { completeness, issues };
}
