import { loadData } from "./dataLoader.js";

let escalationCounter = 1;

function eid() {
  return `ESC-${String(escalationCounter++).padStart(3, "0")}`;
}

/**
 * Determine required escalations based on validation issues, policy evaluation,
 * and supplier shortlist.
 * Returns array of escalation objects.
 */
export function routeEscalations(validation, policyEvaluation, shortlist, request) {
  escalationCounter = 1;
  const { policies } = loadData();
  const escalations = [];
  const { preferred_supplier, approval_threshold } = policyEvaluation;
  const { data_residency_constraint, esg_requirement, scenario_tags = [] } = request;

  const missingFields = validation.issues_detected.filter((i) => i.type === "missing_field");
  if (missingFields.length > 0) {
    escalations.push({
      escalation_id: eid(),
      rule: "ER-001",
      trigger: `Missing required fields: ${missingFields.map((i) => i.description).join("; ")}`,
      escalate_to: "Requester Clarification",
      blocking: true,
    });
  }

  if (preferred_supplier?.is_restricted) {
    escalations.push({
      escalation_id: eid(),
      rule: "ER-002",
      trigger: `Preferred supplier '${preferred_supplier.supplier}' is restricted for this category/country combination.`,
      escalate_to: "Procurement Manager",
      blocking: true,
    });
  }

  const budgetIssue = validation.issues_detected.find((i) => i.type === "budget_insufficient");
  if (budgetIssue) {
    escalations.push({
      escalation_id: eid(),
      rule: "ER-001",
      trigger: budgetIssue.description,
      escalate_to: "Requester Clarification",
      blocking: true,
    });
  }

  const policyConflict = validation.issues_detected.find((i) => i.type === "policy_conflict");
  if (policyConflict && approval_threshold && approval_threshold.quotes_required > 1) {
    escalations.push({
      escalation_id: eid(),
      rule: approval_threshold.rule_applied,
      trigger: `Policy conflict: requester's single-supplier instruction cannot override ${approval_threshold.rule_applied}. Contract value requires ${approval_threshold.quotes_required} quotes.${approval_threshold.deviation_approval ? ` Deviation requires ${approval_threshold.deviation_approval} approval.` : ""}`,
      escalate_to: "Procurement Manager",
      blocking: true,
    });
  }

  if (approval_threshold) {
    const tier = parseInt(approval_threshold.rule_applied.replace(/\D/g, ""), 10);
    if (tier >= 3 && ["AT-003","AT-004","AT-005","AT-008","AT-009","AT-010","AT-013","AT-014","AT-015"].includes(approval_threshold.rule_applied)) {
      escalations.push({
        escalation_id: eid(),
        rule: "ER-003",
        trigger: `Contract value falls in ${approval_threshold.rule_applied}, requiring ${approval_threshold.quotes_required} quotes and ${approval_threshold.deviation_approval ?? "senior"} approval.`,
        escalate_to: "Head of Strategic Sourcing",
        blocking: false,
      });
    }
  }

  const leadIssue = validation.issues_detected.find((i) => i.type === "lead_time_infeasible");
  if (leadIssue || (shortlist.length > 0 && shortlist.length === 0)) {
    if (leadIssue) {
      escalations.push({
        escalation_id: eid(),
        rule: "ER-004",
        trigger: leadIssue.description,
        escalate_to: "Head of Category",
        blocking: true,
      });
    }
  }

  if (shortlist.length === 0) {
    escalations.push({
      escalation_id: eid(),
      rule: "ER-004",
      trigger: "No compliant supplier found for this category, country, and quantity combination.",
      escalate_to: "Head of Category",
      blocking: true,
    });
  }

  if (data_residency_constraint) {
    escalations.push({
      escalation_id: eid(),
      rule: "ER-005",
      trigger: "Request includes a data residency constraint. Supplier selection must be validated against data sovereignty requirements.",
      escalate_to: "Security and Compliance Review",
      blocking: false,
    });
  }

  if (request.category_l1 === "Marketing" && request.category_l2?.includes("Influencer")) {
    escalations.push({
      escalation_id: eid(),
      rule: "ER-007",
      trigger: "Influencer campaign management requires brand-safety review before award.",
      escalate_to: "Marketing Governance Lead",
      blocking: false,
    });
  }

  return escalations;
}
