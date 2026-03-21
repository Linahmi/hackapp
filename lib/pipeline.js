import { getEligibleSuppliers } from "./dataLoader.js";
import { validate } from "./validator.js";
import { evaluatePolicy } from "./policyEngine.js";
import { scoreSuppliers } from "./supplierScorer.js";
import { routeEscalations } from "./escalationRouter.js";
import { generateDecision } from "./decisionEngine.js";
import { buildAuditTrail } from "./auditTrail.js";
import { computeConfidence } from "./confidenceScorer.js";
import { resetTransparencyLogs, getTransparencyLogs } from "./transparencyLogger.js";

/**
 * Process a single atomic line item.
 */
async function processLineItem(item, globalContext = {}) {
  const {
    category_l1,
    category_l2,
    quantity,
    budget_amount,
    currency = "EUR",
    delivery_countries = [],
    required_by_date,
  } = item;

  // Compute days_until_required
  let days_until_required = item.days_until_required ?? null;
  if (required_by_date && days_until_required == null) {
    const now = new Date();
    const due = new Date(required_by_date);
    days_until_required = Math.round((due - now) / (1000 * 60 * 60 * 24));
  }

  const enrichedItem = { ...item, days_until_required };

  // 1. Load eligible suppliers
  const eligibleSuppliers = (category_l1 && category_l2 && delivery_countries.length > 0)
    ? getEligibleSuppliers(category_l1, category_l2, delivery_countries, quantity ?? 1, currency)
    : [];

  // 2. Validate
  const validation = validate(enrichedItem, eligibleSuppliers);

  // 3. Policy evaluation
  const policyEvaluation = evaluatePolicy(enrichedItem, eligibleSuppliers);

  // 4. Score and rank
  const { shortlist, excluded } = scoreSuppliers(eligibleSuppliers, policyEvaluation, enrichedItem);

  // 5. Route escalations
  const escalations = routeEscalations(validation, policyEvaluation, shortlist, enrichedItem);

  // 6. Decision
  const recommendation = await generateDecision(enrichedItem, validation, policyEvaluation, shortlist, escalations);

  // 7. Audit trail
  const audit_trail = buildAuditTrail(enrichedItem, policyEvaluation, shortlist, excluded);

  // 8. Confidence
  const confidence_score = computeConfidence(enrichedItem, validation, policyEvaluation, shortlist);

  return {
    line_id: item.line_id || "default",
    category_l2,
    quantity,
    budget_amount,
    currency,
    confidence_score,
    validation,
    policy_evaluation: policyEvaluation,
    supplier_shortlist: shortlist,
    suppliers_excluded: excluded,
    escalations,
    recommendation,
    audit_trail,
  };
}

/**
 * Run the full procurement processing pipeline.
 * Supports both single-item and multi-item (atomic) requests.
 */
export async function runPipeline(request) {
  resetTransparencyLogs();

  const items = request.items && Array.isArray(request.items) 
    ? request.items 
    : [request];

  const results = await Promise.all(items.map(item => processLineItem(item, request)));

  // If single item, return the result directly (maintaining compatibility)
  if (results.length === 1) {
    const res = results[0];
    return {
      request_id: request.request_id || null,
      processed_at: new Date().toISOString(),
      ...res,
      transparency_report: {
        llm_logs: getTransparencyLogs(),
        regulatory_context: "EU AI Act Art. 13 compliant transparency metadata"
      }
    };
  }

  // If multi-item, return a consolidated result
  return {
    request_id: request.request_id || null,
    processed_at: new Date().toISOString(),
    multi_item: true,
    line_items: results,
    transparency_report: {
      llm_logs: getTransparencyLogs(),
      regulatory_context: "EU AI Act Art. 13 compliant transparency metadata"
    }
  };
}
