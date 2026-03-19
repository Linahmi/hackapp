import { getEligibleSuppliers } from "./dataLoader.js";
import { validate } from "./validator.js";
import { evaluatePolicy } from "./policyEngine.js";
import { scoreSuppliers } from "./supplierScorer.js";
import { routeEscalations } from "./escalationRouter.js";
import { makeDecision } from "./decisionEngine.js";
import { buildAuditTrail } from "./auditTrail.js";
import { computeConfidence } from "./confidenceScorer.js";

/**
 * Run the full procurement processing pipeline on a structured intake request.
 *
 * @param {object} request - Structured request (output of intakeAgent or example_request.json shape).
 * @returns {object} Full processed output matching the example_output.json shape.
 */
export async function runPipeline(request) {
  const {
    request_id,
    category_l1,
    category_l2,
    quantity,
    budget_amount,
    currency = "EUR",
    delivery_countries = [],
    required_by_date,
  } = request;

  // Compute days_until_required
  let days_until_required = request.days_until_required ?? null;
  if (required_by_date && days_until_required == null) {
    const now = new Date();
    const due = new Date(required_by_date);
    days_until_required = Math.round((due - now) / (1000 * 60 * 60 * 24));
  }

  const enrichedRequest = { ...request, days_until_required };

  // 1. Load eligible suppliers with pricing tiers
  const eligibleSuppliers = (category_l1 && category_l2 && delivery_countries.length > 0)
    ? getEligibleSuppliers(category_l1, category_l2, delivery_countries, quantity ?? 1, currency)
    : [];

  // 2. Validate
  const validation = validate(enrichedRequest, eligibleSuppliers);

  // 3. Policy evaluation
  const policyEvaluation = evaluatePolicy(enrichedRequest, eligibleSuppliers);

  // 4. Score and rank suppliers
  const { shortlist, excluded } = scoreSuppliers(eligibleSuppliers, policyEvaluation, enrichedRequest);

  // 5. Route escalations
  const escalations = routeEscalations(validation, policyEvaluation, shortlist, enrichedRequest);

  // 6. Decision
  const recommendation = makeDecision(validation, policyEvaluation, shortlist, escalations, enrichedRequest);

  // 7. Audit trail
  const audit_trail = buildAuditTrail(enrichedRequest, policyEvaluation, shortlist, excluded);

  // 8. Confidence score
  const confidence_score = computeConfidence(enrichedRequest, validation, policyEvaluation, shortlist);

  return {
    request_id: request_id ?? null,
    processed_at: new Date().toISOString(),
    confidence_score,

    request_interpretation: {
      category_l1,
      category_l2,
      quantity,
      unit_of_measure: request.unit_of_measure ?? null,
      budget_amount,
      currency,
      delivery_countries,
      required_by_date,
      days_until_required,
      data_residency_required: request.data_residency_constraint ?? false,
      esg_requirement: request.esg_requirement ?? false,
      preferred_supplier_stated: request.preferred_supplier_mentioned ?? null,
      incumbent_supplier: request.incumbent_supplier ?? null,
      requester_instruction: request.scenario_tags?.includes("single_source")
        ? "single supplier only"
        : null,
      gaps: request.gaps ?? [],
      detected_language: request.request_language ?? "en",
    },

    validation,
    policy_evaluation: policyEvaluation,
    supplier_shortlist: shortlist,
    suppliers_excluded: excluded,
    escalations,
    recommendation,
    audit_trail,
  };
}
