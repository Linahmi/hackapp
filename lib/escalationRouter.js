import { loadData } from "./dataLoader.js";

// ─── Hierarchy ────────────────────────────────────────────────────────────────
// L1  Requester                  — Missing/invalid info. Always blocking.
// L2  Business Owner             — Low-value self-approval (<€25k). Non-blocking.
// L3  Procurement Manager        — Restricted supplier, policy conflict, AT-002.
// L4  Head of Category           — No supplier, infeasible lead time, AT-003.
// L5  Head of Strategic Sourcing — High value AT-004, data residency, ESG.
// L6  CPO                        — Strategic >€5M, brand risk, cross-border.

const HIERARCHY = {
  L1: { level: 1, role: "Requester",                    label: "Requester",                    color: "#94a3b8" },
  L2: { level: 2, role: "Business Owner",               label: "Business Owner",               color: "#60a5fa" },
  L3: { level: 3, role: "Procurement Manager",          label: "Procurement Manager",           color: "#f59e0b" },
  L4: { level: 4, role: "Head of Category",             label: "Head of Category",             color: "#fb923c" },
  L5: { level: 5, role: "Head of Strategic Sourcing",   label: "Head of Strategic Sourcing",   color: "#a78bfa" },
  L6: { level: 6, role: "CPO",                          label: "CPO",                          color: "#f43f5e" },
};

const THRESHOLD_LEVEL = {
  "AT-001": "L2", "AT-006": "L2", "AT-011": "L2",
  "AT-002": "L3", "AT-007": "L3", "AT-012": "L3",
  "AT-003": "L4", "AT-008": "L4", "AT-013": "L4",
  "AT-004": "L5", "AT-009": "L5", "AT-014": "L5",
  "AT-005": "L6", "AT-010": "L6", "AT-015": "L6",
};

let escalationCounter = 1;
function eid() { return `ESC-${String(escalationCounter++).padStart(3, "0")}`; }

function esc(rule, trigger, levelKey, blockingOverride = null, action = null) {
  const h = HIERARCHY[levelKey];
  const defaultBlocking = h.level === 1 || h.level >= 4;
  return {
    escalation_id: eid(),
    rule,
    trigger,
    escalate_to: h.role,
    hierarchy_level: h.level,
    hierarchy_label: h.label,
    hierarchy_color: h.color,
    blocking: blockingOverride !== null ? blockingOverride : defaultBlocking,
    action: action ?? `Resolve and re-submit to ${h.role}`,
  };
}

export function routeEscalations(validation, policyEvaluation, shortlist, request) {
  escalationCounter = 1;
  const escalations = [];
  const { preferred_supplier, approval_threshold, restricted_suppliers = {} } = policyEvaluation;
  const { data_residency_constraint, esg_requirement, category_l1, category_l2, budget_amount, quantity } = request;
  const issues = validation?.issues ?? validation?.issues_detected ?? [];

  // ── L1: Requester — invalid / incomplete input ─────────────────────────
  const invalidIssues = issues.filter(i =>
    ["missing_quantity", "missing_budget", "deadline_passed", "contradictory_request"].includes(i.type)
  );
  if (invalidIssues.length > 0) {
    escalations.push(esc("ER-001",
      `Requester must fix before processing: ${invalidIssues.map(i => i.description).join(" | ")}`,
      "L1", true, "Provide missing or corrected information"));
  }

  const budgetInsufficient = issues.find(i => i.type === "budget_insufficient");
  if (budgetInsufficient) {
    const gap = budgetInsufficient.minimum_required ? budgetInsufficient.minimum_required - (budget_amount || 0) : null;
    const levelKey = gap && gap > 500000 ? "L5" : gap && gap > 100000 ? "L4" : "L3";
    escalations.push(esc("ER-001", budgetInsufficient.description, levelKey, true,
      "Increase budget or reduce quantity, then resubmit"));
  }

  // ── L2: Business Owner — low-value self-approval ───────────────────────
  if (approval_threshold && THRESHOLD_LEVEL[approval_threshold.rule_applied] === "L2") {
    escalations.push(esc(approval_threshold.rule_applied,
      `Contract value is within self-approval tier (${approval_threshold.rule_applied}). Business owner must confirm before award.`,
      "L2", false, "Business owner confirms and approves purchase order"));
  }

  // ── L3: Procurement Manager ────────────────────────────────────────────
  if (preferred_supplier?.is_restricted) {
    escalations.push(esc("ER-002",
      `Preferred supplier '${preferred_supplier.supplier}' is restricted for ${category_l2} in this region. Select from approved list.`,
      "L3", true, "Select a compliant supplier from the approved list"));
  }

  if (request.preferred_supplier_stated && !preferred_supplier) {
    escalations.push(esc("ER-002",
      `Requester's preferred supplier '${request.preferred_supplier_stated}' is not on the approved supplier list — manual review required.`,
      "L3", true, "Verify supplier is onboarded and approved, or select from the approved supplier list"));
  }

  const restrictedCount = Object.keys(restricted_suppliers).length;
  if (restrictedCount > 0 && !preferred_supplier?.is_restricted) {
    escalations.push(esc("ER-002",
      `${restrictedCount} supplier(s) excluded due to policy restrictions. Procurement Manager must confirm shortlist.`,
      "L3", false, "Review and confirm restricted supplier exclusions"));
  }

  const policyConflict = issues.find(i => i.type === "policy_conflict");
  if (policyConflict && approval_threshold?.quotes_required > 1) {
    escalations.push(esc(approval_threshold.rule_applied,
      `Requester requested single-supplier but ${approval_threshold.rule_applied} mandates ${approval_threshold.quotes_required} competitive quotes. Deviation requires Procurement Manager sign-off.`,
      "L3", true,
      `Run competitive sourcing for ${approval_threshold.quotes_required} quotes or get deviation approval`));
  }

  if (approval_threshold && THRESHOLD_LEVEL[approval_threshold.rule_applied] === "L3") {
    const devNote = approval_threshold.deviation_approval ? ` Deviation: ${approval_threshold.deviation_approval}.` : "";
    escalations.push(esc(approval_threshold.rule_applied,
      `Contract value triggers ${approval_threshold.rule_applied} — ${approval_threshold.quotes_required} quotes required and Procurement Manager approval.${devNote}`,
      "L3", false,
      `Obtain ${approval_threshold.quotes_required} supplier quotes and Procurement Manager sign-off`));
  }

  // ── L4: Head of Category ───────────────────────────────────────────────
  if (shortlist.length === 0) {
    escalations.push(esc("ER-004",
      `No compliant supplier found for ${category_l2} in the requested region${quantity ? ` at qty ${quantity}` : ""}. Head of Category must identify alternatives.`,
      "L4", true, "Identify and onboard a compliant supplier or approve exception"));
  }

  const leadInfeasible = issues.find(i => i.type === "lead_time_infeasible");
  if (leadInfeasible) {
    escalations.push(esc("ER-004", leadInfeasible.description, "L4", true,
      "Negotiate expedited delivery or revise the delivery timeline"));
  }

  const leadCritical = issues.find(i => i.type === "lead_time_critical");
  if (leadCritical && !leadInfeasible) {
    escalations.push(esc("ER-004",
      `${leadCritical.description} Head of Category must confirm expedited delivery and approve premium cost.`,
      "L4", false, "Confirm supplier can meet deadline on expedited terms"));
  }

  if (approval_threshold && THRESHOLD_LEVEL[approval_threshold.rule_applied] === "L4") {
    escalations.push(esc(approval_threshold.rule_applied,
      `Contract value triggers ${approval_threshold.rule_applied} — ${approval_threshold.quotes_required} quotes required. Head of Category approval needed.`,
      "L4", false,
      `Run formal RFQ with ${approval_threshold.quotes_required} suppliers and obtain Head of Category sign-off`));
  }

  // ── L5: Head of Strategic Sourcing ────────────────────────────────────
  if (data_residency_constraint) {
    escalations.push(esc("ER-005",
      "Data residency/sovereignty constraint detected. Supplier selection must be validated by Head of Strategic Sourcing and Security.",
      "L5", false, "Run data sovereignty review before award"));
  }

  if (esg_requirement) {
    escalations.push(esc("ER-005",
      "ESG/sustainability requirement flagged. Supplier ESG scores must be validated against policy minimums.",
      "L5", false, "Validate ESG certification and conduct sustainability audit"));
  }

  if (approval_threshold && THRESHOLD_LEVEL[approval_threshold.rule_applied] === "L5") {
    const devNote = approval_threshold.deviation_approval ? ` Deviation: ${approval_threshold.deviation_approval}.` : "";
    escalations.push(esc(approval_threshold.rule_applied,
      `Contract value triggers ${approval_threshold.rule_applied} — strategic sourcing review required. ${approval_threshold.quotes_required} competitive quotes mandatory.${devNote}`,
      "L5", true,
      `Conduct strategic RFP/RFQ with ${approval_threshold.quotes_required} qualified suppliers`));
  }

  // ── L6: CPO ───────────────────────────────────────────────────────────
  if (approval_threshold && THRESHOLD_LEVEL[approval_threshold.rule_applied] === "L6") {
    const devNote = approval_threshold.deviation_approval ? ` Deviation: ${approval_threshold.deviation_approval}.` : "";
    escalations.push(esc(approval_threshold.rule_applied,
      `Contract value exceeds strategic threshold (${approval_threshold.rule_applied}). CPO approval mandatory.${devNote}`,
      "L6", true, "Prepare executive business case and obtain CPO sign-off before sourcing"));
  }

  if (category_l1 === "Marketing" && category_l2?.toLowerCase().includes("influencer")) {
    escalations.push(esc("ER-007",
      "Influencer campaign carries brand-safety and reputational risk. CPO sign-off required before award.",
      "L6", true, "Submit brand-safety assessment and obtain CPO approval"));
  }

  const restrictedCategory = issues.find(i => i.type === "restricted_category");
  if (restrictedCategory) {
    escalations.push(esc("ER-008", restrictedCategory.description, "L6", true,
      "Obtain CPO and Legal sign-off for restricted category procurement"));
  }

  // Sort: most senior first, then blocking before non-blocking
  escalations.sort((a, b) => {
    if (b.hierarchy_level !== a.hierarchy_level) return b.hierarchy_level - a.hierarchy_level;
    return (b.blocking ? 1 : 0) - (a.blocking ? 1 : 0);
  });

  return escalations;
}

/**
 * Legacy shim — used by route.js manual trigger list.
 */
export function buildEscalations(triggers, estimatedSavings = null) {
  const RULE_TO_LEVEL = {
    "ER-001": "L1", "ER-002": "L3", "ER-003": "L5",
    "ER-004": "L4", "ER-005": "L5", "ER-006": "L5",
    "ER-007": "L6", "ER-008": "L6",
  };
  return triggers.map((t, i) => {
    const levelKey = RULE_TO_LEVEL[t.rule] || "L3";
    const h = HIERARCHY[levelKey];
    return {
      escalation_id: `ESC-${String(i + 1).padStart(3, "0")}`,
      rule: t.rule,
      trigger: t.reason,
      escalate_to: h.role,
      hierarchy_level: h.level,
      hierarchy_label: h.label,
      hierarchy_color: h.color,
      blocking: t.blocking ?? h.level >= 4,
      action: `Resolve and re-submit to ${h.role}`,
      estimated_savings: estimatedSavings,
    };
  });
}
