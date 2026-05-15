import { getData, getEligibleSuppliers } from './dataLoader.js';
import { searchMarketCandidates } from './exaSupplierSearch';
import { parseRequest, fillGapsFromHistory } from './intakeAgent.js';
import { checkApprovalTier, checkPreferredSupplier, checkCategoryRules, checkGeographyRules } from './policyEngine.js';
import { scoreSuppliers } from './supplierScorer.js';
import { routeEscalations } from './escalationRouter.js';
import { findHistoricalContext } from './historicalLookup.js';
import { generateDecision } from './decisionEngine.js';
import { detectBundlingOpportunity } from './bundlingDetector.js';
import { computeConcentration } from './concentrationScorer.js';
import { generateCounterfactuals } from './counterfactualEngine.js';
import { explainConfidence } from './confidenceScorer.js';
import { getNextRequestId, logRequest } from './requestCounter.js';
import { logAuditEvent, AUDIT_EVENTS, flushAuditEventsToDB } from './auditLogger.js';
import { resetTransparencyLogs, getTransparencyLogs } from './transparencyLogger.js';

const HARD_BLOCK_CASE_TYPES = ['FAILED_IMPOSSIBLE_DATE', 'MORE_INFO_REQUIRED', 'NO_SUPPLIER_AVAILABLE', 'PENDING_RESOLUTION'];
const TIER_ESCALATION_TARGETS = { 2: 'Procurement Manager', 3: 'Head of Category', 4: 'Head of Strategic Sourcing', 5: 'CPO' };

// Artificial pacing so each UI step is readable. Remove if real latency is sufficient.
const delay = ms => new Promise(r => setTimeout(r, ms));

function scoreForPipeline(l1, l2, countries, qty, currency, originalReq, days_until_required, budget_amount, historicalContext) {
  const eligible = getEligibleSuppliers(l1, l2, countries, qty, currency);
  const { policies } = getData();
  const restricted_suppliers = {};
  for (const { supplier } of eligible) {
    const entry = policies.restricted_suppliers?.find(r => r.supplier_id === supplier.supplier_id);
    if (entry) {
      restricted_suppliers[`${supplier.supplier_id}_${supplier.supplier_name.replace(/ /g, '_')}`] = {
        restricted: true,
        reason: entry.restriction_reason,
      };
    }
  }
  return scoreSuppliers(
    eligible,
    { restricted_suppliers },
    { quantity: qty, currency, days_until_required, incumbent_supplier: originalReq?.incumbent_supplier, budget_amount, historicalContext },
  );
}

/**
 * Run the full procurement pipeline.
 *
 * @param {{ text: string, request_id?: string, session?: object }} request
 * @param {{ onStep?: (event: object) => void }} options
 *   onStep is called at every progress point with { step, status, pct, thinking?, requestId? }.
 *   Wire it to SSE send() in the route; leave undefined for synchronous callers.
 *
 * @returns {{ reqId, isAutoApproved, requiredApprover, enrichedRequest, result }}
 */
export async function runPipeline({ text, request_id, session } = {}, { onStep } = {}) {
  resetTransparencyLogs();
  const emit = onStep ?? (() => {});

  // ── Assign request ID ──────────────────────────────────────────────────────
  const reqId = await getNextRequestId();
  logAuditEvent({ action: AUDIT_EVENTS.REQUEST_RECEIVED, requestId: reqId, metadata: { text_preview: text?.slice(0, 120) } });

  // ── Step 1: Parsing (0 → 20%) ──────────────────────────────────────────────
  let parsingThinking = `[${reqId}] Analyzing request context...\n`;
  emit({ step: 'parsing', status: 'active', pct: 0, requestId: reqId, thinking: parsingThinking });

  const data = getData();
  const originalRequest = request_id ? (data.requests || []).find(r => r.request_id === request_id) || {} : {};

  const structuredRequest = await parseRequest(text, originalRequest, chunk => {
    parsingThinking += chunk;
    emit({ step: 'parsing', status: 'active', pct: 10, requestId: reqId, thinking: parsingThinking });
  });

  const historicalLookupResult = findHistoricalContext(
    structuredRequest.category_l2,
    structuredRequest.delivery_countries || [],
    originalRequest?.business_unit,
  );
  const historicalContext = historicalLookupResult.records;
  const enrichedRequest = fillGapsFromHistory(
    structuredRequest,
    historicalContext.filter(r => r.awarded),
    structuredRequest.currency || 'EUR',
  );

  const parsedBudget = enrichedRequest.budget_amount
    ? `${enrichedRequest.currency || 'EUR'} ${enrichedRequest.budget_amount.toLocaleString()}`
    : null;
  const inferredFields = enrichedRequest.assumptions?.length
    ? `Inferred from history: ${enrichedRequest.assumptions.slice(0, 2).join(' · ')}`
    : historicalContext.length > 0
    ? `${historicalContext.length} historical award(s) consulted — no gaps to fill`
    : 'No historical context found for this category/region';
  emit({ step: 'parsing', status: 'done', pct: 20, thinking: `Extracted: ${enrichedRequest.category_l1 || '?'} › ${enrichedRequest.category_l2 || '?'} · qty ${enrichedRequest.quantity ?? '?'} · budget ${parsedBudget ?? 'not stated'} · supplier ${enrichedRequest.preferred_supplier_stated ?? 'none stated'}\n${inferredFields}` });

  logAuditEvent({ action: AUDIT_EVENTS.REQUEST_PARSED, requestId: reqId, metadata: { category: enrichedRequest.category_l2, quantity: enrichedRequest.quantity, budget: enrichedRequest.budget_amount, currency: enrichedRequest.currency, gaps: enrichedRequest.gaps, assumptions_applied: (enrichedRequest.assumptions?.length ?? 0) > 0 } });

  // ── Step 2: Rules (25 → 40%) ───────────────────────────────────────────────
  await delay(1000);
  emit({ step: 'rules', status: 'active', pct: 25, thinking: `Checking compliance rules…\n${[
    `Approval tier: ${enrichedRequest.budget_amount ? `${enrichedRequest.currency ?? 'EUR'} ${enrichedRequest.budget_amount?.toLocaleString()}` : 'budget unknown'}`,
    enrichedRequest.preferred_supplier_stated ? `Preferred supplier: ${enrichedRequest.preferred_supplier_stated}` : 'No preferred supplier stated',
    enrichedRequest.days_until_required != null ? `Delivery: ${enrichedRequest.days_until_required} days` : 'No delivery date',
    `Countries: ${(enrichedRequest.delivery_countries ?? []).join(', ') || 'not specified'}`,
  ].join(' · ')}` });

  const issues = [];
  if (structuredRequest.demand_reframe_flag) issues.push({ issue_id: 'V-000', severity: 'warning', type: 'contradictory_request', description: 'Request contains contradictory or unreasonable information — AI flagged this for review', action_required: 'Clarify the request before proceeding' });
  if (!enrichedRequest.quantity || enrichedRequest.quantity <= 0) issues.push({ issue_id: 'V-001', severity: 'critical', type: 'missing_quantity', description: 'Quantity not specified or invalid (must be > 0)', action_required: 'Provide a valid quantity' });
  if (!enrichedRequest.budget_amount) issues.push({ issue_id: 'V-002', severity: 'critical', type: 'missing_budget', description: 'Budget not specified', action_required: 'Provide budget' });
  if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 0) {
    issues.push({ issue_id: 'V-003', severity: 'critical', type: 'deadline_passed', description: `Requested delivery date is in the past (${Math.abs(enrichedRequest.days_until_required)} days ago)`, action_required: 'Provide a valid future delivery date' });
  } else if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 10) {
    issues.push({ issue_id: 'V-003', severity: 'high', type: 'lead_time_critical', description: 'Delivery deadline is extremely tight', action_required: 'Confirm if deadline is flexible' });
  }

  const approvalThreshold = checkApprovalTier(enrichedRequest.budget_amount || 0, enrichedRequest.currency);
  const preferredCheck = enrichedRequest.preferred_supplier_stated
    ? checkPreferredSupplier(enrichedRequest.preferred_supplier_stated, enrichedRequest.category_l2, enrichedRequest.delivery_countries?.[0] || 'DE')
    : null;
  const categoryRules = checkCategoryRules(enrichedRequest.category_l1, enrichedRequest.category_l2);
  const geoRules = checkGeographyRules(enrichedRequest.delivery_countries || [], originalRequest?.data_residency_constraint || false);
  const policyResult = { approval_threshold: approvalThreshold, preferred_supplier: preferredCheck, category_rules: categoryRules, geography_rules: geoRules, violations: [] };

  await delay(800);
  const tierLabel = approvalThreshold ? `Approval tier: ${approvalThreshold.rule_applied} (${approvalThreshold.quotes_required} quote(s) required)` : 'Tier: below threshold';
  emit({ step: 'rules', status: 'done', pct: 40, thinking: issues.length === 0 ? `All compliance checks passed ✓ · ${tierLabel}` : `${issues.length} issue(s) found · ${issues.map(i => i.description).join(' · ')} · ${tierLabel}` });

  // ── Step 3: Scoring (45 → 60%) ─────────────────────────────────────────────

  // Kick off Exa discovery in parallel — runs during the delay + CSV scoring so no added latency
  const exaPromise = searchMarketCandidates(
    enrichedRequest.category_l2 ?? enrichedRequest.category_l1 ?? '',
    enrichedRequest.delivery_countries?.[0],
  ).catch(() => []);

  await delay(1000);
  const safeQty = enrichedRequest.quantity > 0 ? enrichedRequest.quantity : 1;
  const eligibleCount = getEligibleSuppliers(enrichedRequest.category_l1, enrichedRequest.category_l2, enrichedRequest.delivery_countries || [], safeQty, enrichedRequest.currency || 'EUR').length;
  emit({ step: 'scoring', status: 'active', pct: 45, thinking: `Found ${eligibleCount} eligible supplier(s) for ${enrichedRequest.category_l2 ?? enrichedRequest.category_l1 ?? 'this category'} in [${(enrichedRequest.delivery_countries ?? []).join(', ')}] · Scoring on price (30%), lead time (30%), quality (20%), risk (10%), ESG (10%)…` });

  const { shortlist: csvSuppliers, excluded: excludedSuppliers } = scoreForPipeline(
    enrichedRequest.category_l1, enrichedRequest.category_l2,
    enrichedRequest.delivery_countries || [], safeQty, enrichedRequest.currency || 'EUR',
    originalRequest, enrichedRequest.days_until_required, enrichedRequest.budget_amount, historicalContext,
  );

  // Merge Exa live candidates into the shortlist (Exa ran during the 1s delay above)
  const exaDiscovery = await exaPromise;
  const exaCandidates = buildExaShortlistEntries(exaDiscovery, csvSuppliers, safeQty, enrichedRequest.currency || 'EUR', enrichedRequest.budget_amount);
  const rankedSuppliers = [...csvSuppliers, ...exaCandidates];
  rankedSuppliers.sort((a, b) => b.composite_score - a.composite_score);
  rankedSuppliers.forEach((s, i) => { s.rank = i + 1; });
  rankedSuppliers.forEach(s => { if (s.supplier_id === originalRequest?.incumbent_supplier) s.incumbent = true; });

  let minimumRequired = null;
  if (rankedSuppliers.length > 0 && enrichedRequest.quantity && enrichedRequest.budget_amount) {
    const lowestUnitPrice = Math.min(...rankedSuppliers.map(s => s.unit_price));
    minimumRequired = lowestUnitPrice * enrichedRequest.quantity;
    if (enrichedRequest.budget_amount < minimumRequired) {
      issues.push({ issue_id: 'V-004', severity: 'critical', type: 'budget_insufficient', description: `Budget of ${enrichedRequest.budget_amount} ${enrichedRequest.currency} cannot cover ${enrichedRequest.quantity} units. Minimum required: ${minimumRequired.toFixed(2)} ${enrichedRequest.currency}`, action_required: 'Increase budget or reduce quantity', minimum_required: minimumRequired });
    }
  }

  const validationResult = { completeness: issues.length === 0 ? 'pass' : 'fail', issues };

  await delay(800);
  emit({ step: 'scoring', status: 'done', pct: 60, thinking: rankedSuppliers.length > 0
    ? `Ranked ${rankedSuppliers.length} supplier(s) (${csvSuppliers.length} internal${exaCandidates.length ? `, ${exaCandidates.length} from live market search` : ''})${excludedSuppliers?.length ? ` · ${excludedSuppliers.length} excluded` : ''} · #1: ${rankedSuppliers[0].supplier_name}${rankedSuppliers[0].unvetted ? ' [unvetted]' : ''} — score ${Math.round(rankedSuppliers[0].composite_score * 100)}/100, ${rankedSuppliers[0].unit_price?.toLocaleString()} ${enrichedRequest.currency ?? 'EUR'}/unit, lead time ${rankedSuppliers[0].standard_lead_time_days}d`
    : `No eligible suppliers found for ${enrichedRequest.category_l2 ?? 'this category'} in [${(enrichedRequest.delivery_countries ?? []).join(', ')}]`,
  });

  logAuditEvent({ action: rankedSuppliers.length > 0 ? AUDIT_EVENTS.SUPPLIERS_SCORED : AUDIT_EVENTS.NO_SUPPLIER_FOUND, requestId: reqId, metadata: { shortlisted: rankedSuppliers.length, excluded: excludedSuppliers?.length ?? 0, top_supplier: rankedSuppliers[0]?.supplier_name ?? null, top_score: rankedSuppliers[0] ? Math.round(rankedSuppliers[0].composite_score * 100) : null } });

  // ── Step 4: Decision (65 → 85%) ────────────────────────────────────────────
  await delay(800);

  // Lead-time infeasibility check — requires rankedSuppliers, so done here not in rules
  if (enrichedRequest.days_until_required && rankedSuppliers.length > 0) {
    const fastestExpedited = Math.min(...rankedSuppliers.map(s => s.expedited_lead_time_days || 999));
    if (fastestExpedited > enrichedRequest.days_until_required) {
      issues.push({ issue_id: 'V-005', severity: 'critical', type: 'lead_time_infeasible', description: `Required in ${enrichedRequest.days_until_required} days but fastest supplier delivers in ${fastestExpedited} days.`, action_required: 'Negotiate expedited delivery or revise deadline' });
    }
  }
  // Single-supplier override attempt against a multi-quote policy
  if (approvalThreshold && approvalThreshold.tier >= 2 && enrichedRequest.preferred_supplier_stated) {
    const requestText = (originalRequest?.request_text || text || '').toLowerCase();
    if (requestText.includes('no exception') || requestText.includes('only') || requestText.includes('must use')) {
      issues.push({ issue_id: 'V-006', severity: 'high', type: 'policy_conflict', description: `Policy ${approvalThreshold.rule_applied} requires ${approvalThreshold.quotes_required} quotes. Single-supplier instruction cannot override.` });
    }
  }

  const hasImpossibleDate = issues.some(i => i.type === 'deadline_passed' || i.type === 'lead_time_infeasible');
  const hasUnclearIntent  = structuredRequest.unclear_intent === true || (!enrichedRequest.category_l2 && !enrichedRequest.category_l1);
  const hasBudgetIssue    = issues.some(i => i.type === 'budget_insufficient');
  let case_type;
  if      (hasImpossibleDate)                                              case_type = 'FAILED_IMPOSSIBLE_DATE';
  else if (hasUnclearIntent)                                               case_type = 'MORE_INFO_REQUIRED';
  else if (hasBudgetIssue)                                                 case_type = 'PENDING_RESOLUTION';
  else if (rankedSuppliers.length === 0)                                   case_type = 'NO_SUPPLIER_AVAILABLE';
  else if (structuredRequest.demand_reframe_flag && rankedSuppliers.length > 0) case_type = 'SIMILAR_NOT_EXACT_MATCH';
  else                                                                     case_type = 'READY_FOR_VALIDATION';

  const enrichedForEscalation = { ...enrichedRequest, data_residency_constraint: originalRequest?.data_residency_constraint, esg_requirement: originalRequest?.esg_requirement };
  const escalations = routeEscalations(validationResult, policyResult, rankedSuppliers, enrichedForEscalation);
  const estimatedSavings = enrichedRequest.budget_amount && rankedSuppliers[0] ? Math.max(0, Math.round(enrichedRequest.budget_amount - rankedSuppliers[0].total_price)) : null;
  escalations.forEach(e => { e.estimated_savings = estimatedSavings; });

  if (approvalThreshold?.tier >= 2 && !escalations.some(e => e.rule === 'ER-003')) {
    const target = TIER_ESCALATION_TARGETS[approvalThreshold.tier] || 'Procurement Manager';
    const isBlocking = approvalThreshold.tier >= 4;
    escalations.push({
      escalation_id: `ESC-${String(escalations.length + 1).padStart(3, '0')}`,
      rule: 'ER-003',
      trigger: `Tier ${approvalThreshold.tier} spend requires ${target} sign-off (${approvalThreshold.quotes_required} quote(s) required, value: ${enrichedRequest.budget_amount?.toLocaleString() ?? '?'} ${enrichedRequest.currency ?? ''}).`,
      escalate_to: target,
      hierarchy_level: approvalThreshold.tier + 1,
      hierarchy_label: target,
      hierarchy_color: isBlocking ? '#f43f5e' : '#a78bfa',
      blocking: isBlocking,
      action: `Route to ${target} for approval before award`,
      estimated_savings: estimatedSavings,
    });
  }

  const isHardBlock = HARD_BLOCK_CASE_TYPES.includes(case_type);
  if (isHardBlock) escalations.splice(0, escalations.length, ...escalations.filter(e => e.blocking));

  const blockingCount = escalations.filter(e => e.blocking).length;
  const caseTypeLabel = { READY_FOR_VALIDATION: 'Ready for validation', FAILED_IMPOSSIBLE_DATE: 'Blocked — impossible deadline', MORE_INFO_REQUIRED: 'Blocked — unclear request', PENDING_RESOLUTION: 'Blocked — pending resolution', NO_SUPPLIER_AVAILABLE: 'Blocked — no compliant supplier', SIMILAR_NOT_EXACT_MATCH: 'Partial match — demand reframed' }[case_type] ?? case_type;
  let decisionThinking = `Case type: ${caseTypeLabel} · ${blockingCount} blocking escalation(s) · ${rankedSuppliers.length} supplier(s) shortlisted\n\n`;
  emit({ step: 'decision', status: 'active', pct: 65, thinking: decisionThinking });

  const decision = await generateDecision(enrichedRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext, chunk => {
    decisionThinking += chunk;
    emit({ step: 'decision', status: 'active', pct: 75, thinking: decisionThinking });
  });

  if (decision.status === 'cannot_proceed' && case_type === 'READY_FOR_VALIDATION') case_type = 'PENDING_RESOLUTION';

  const bundlingOpportunity = (!isHardBlock && rankedSuppliers.length > 0)
    ? detectBundlingOpportunity(enrichedRequest, rankedSuppliers)
    : null;

  let concentrationResult = { risk_level: 'unknown', hhi: 0, warning: false };
  let counterfactuals = [];
  try {
    concentrationResult = computeConcentration(enrichedRequest.category_l2, enrichedRequest.delivery_countries?.[0], historicalContext);
    counterfactuals     = generateCounterfactuals(rankedSuppliers, enrichedRequest);
    if (concentrationResult.warning) rankedSuppliers.forEach(s => { s.concentration_warning = true; });
  } catch (err) {
    console.error('[pipeline] Error computing concentration/counterfactuals:', err);
  }

  emit({ step: 'decision', status: 'done', pct: 85, thinking: decision.status === 'recommended'
    ? `✓ Recommending ${decision.preferred_supplier_if_resolved || rankedSuppliers[0]?.supplier_name} — ${decision.decision_summary ?? ''}`
    : `✗ Cannot proceed — ${escalations.filter(e => e.blocking).map(e => e.rule).join(', ')} · ${decision.decision_summary ?? 'manual intervention required'}`,
  });

  if (escalations.length > 0) logAuditEvent({ action: AUDIT_EVENTS.ESCALATION_RAISED, requestId: reqId, metadata: { count: escalations.length, blocking: escalations.filter(e => e.blocking).length, escalated_to: escalations.map(e => e.escalate_to), rules: escalations.map(e => e.rule) } });
  logAuditEvent({ action: AUDIT_EVENTS.DECISION_GENERATED, requestId: reqId, metadata: { case_type, decision_status: decision.status, top_supplier: rankedSuppliers[0]?.supplier_name ?? null } });

  // ── Step 5: Confidence + auto-approval (90 → 100%) ────────────────────────
  await delay(600);
  emit({ step: 'logged', status: 'active', pct: 90, thinking: 'Writing audit trail and computing confidence score…' });

  const hasBlockingValidationIssue = issues.some(i => i.severity === 'critical');
  const isAutoApproved = approvalThreshold?.tier === 1 && escalations.length === 0 && !hasBlockingValidationIssue;

  let requiredApprover = null;
  if (!isAutoApproved) {
    requiredApprover = escalations.length > 0
      ? [...escalations].sort((a, b) => (b.hierarchy_level || 0) - (a.hierarchy_level || 0))[0].escalate_to
      : approvalThreshold?.approver || approvalThreshold?.approvers?.[0] || 'Procurement Manager';
  }

  const confidenceResult = explainConfidence(enrichedRequest, validationResult, policyResult, rankedSuppliers, escalations, { ...decision, is_auto_approved: isAutoApproved });
  const confidence = confidenceResult.score;

  await delay(500);
  emit({ step: 'logged', status: 'done', pct: 100, thinking: isAutoApproved
    ? `Confidence: ${confidence}% · Auto-approved ✓ · Audit trail written · ${rankedSuppliers.length} supplier(s) evaluated`
    : `Confidence: ${confidence}% · Requires sign-off from ${requiredApprover} · ${escalations.length} escalation(s) raised · Audit trail written`,
  });

  logAuditEvent({ action: isAutoApproved ? AUDIT_EVENTS.AUTO_APPROVED : AUDIT_EVENTS.APPROVAL_REQUIRED, requestId: reqId, metadata: { confidence, required_approver: requiredApprover ?? null, escalation_count: escalations.length } });

  await logRequest(reqId, { category: `${enrichedRequest.category_l1} > ${enrichedRequest.category_l2}`, quantity: enrichedRequest.quantity, budget: enrichedRequest.budget_amount, status: decision.status });
  await flushAuditEventsToDB(reqId);

  const result = {
    request_id:          reqId,
    processed_at:        new Date().toISOString(),
    confidence_score:    confidence,
    confidence_details:  confidenceResult.drivers,
    request_interpretation: enrichedRequest,
    validation:          validationResult,
    policy_evaluation:   policyResult,
    supplier_shortlist:  rankedSuppliers.map(s => ({ ...s, composite_score_pct: Math.round(s.composite_score * 100) })),
    suppliers_excluded:  excludedSuppliers ?? [],
    concentration_risk:  concentrationResult,
    counterfactuals,
    escalations,
    bundling_opportunity: bundlingOpportunity,
    case_type,
    recommendation: {
      ...decision,
      is_auto_approved:          isAutoApproved,
      required_approver:         requiredApprover,
      minimum_budget_required:   minimumRequired,
      minimum_budget_currency:   minimumRequired ? (enrichedRequest.currency ?? 'EUR') : null,
      savings_vs_budget_pct:     (enrichedRequest.budget_amount && rankedSuppliers[0]?.total_price)
        ? Math.round(((enrichedRequest.budget_amount - rankedSuppliers[0].total_price) / enrichedRequest.budget_amount) * 100)
        : null,
    },
    audit_trail: {
      policies_checked:             ['AT-001', 'AT-002', 'AT-003', 'AT-004', 'AT-005', 'ER-001', 'ER-002', 'ER-004', 'ER-005'],
      supplier_ids_evaluated:       rankedSuppliers.map(s => s.supplier_id),
      data_sources_used:            ['requests.json', 'suppliers.csv', 'pricing.csv', 'policies.json', 'historical_awards.csv', ...(exaCandidates.length ? ['exa_market_search'] : [])],
      historical_awards_consulted:  historicalContext.length > 0,
      historical_records:           historicalContext,
      client_scope_used:            historicalLookupResult.match_level,
      assumptions:                  enrichedRequest.assumptions || [],
      inference_applied:            (enrichedRequest.assumptions?.length ?? 0) > 0,
      generated_at:                 new Date().toISOString(),
    },
    transparency_report: {
      llm_logs:           getTransparencyLogs(),
      regulatory_context: 'EU AI Act Art. 13 compliant transparency metadata',
    },
  };

  return { reqId, isAutoApproved, requiredApprover, enrichedRequest, result };
}

// ─── Exa shortlist builder ────────────────────────────────────────────────────
// Takes Exa discovery results, deduplicates against CSV suppliers, and returns
// shortlist-compatible entries with median CSV pricing as a price proxy.
function buildExaShortlistEntries(exaDiscovery, csvSuppliers, quantity, currency, budgetAmount) {
  const liveCandidates = (exaDiscovery?.[0]?.liveCandidates ?? []).filter(c => c.source === 'exa');
  if (!liveCandidates.length) return [];

  // Use median unit price and lead time from CSV as proxy values
  const sortedPrices = csvSuppliers.map(s => s.unit_price).filter(Boolean).sort((a, b) => a - b);
  const medianUnitPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];
  if (!medianUnitPrice) return []; // can't price them without a baseline

  const sortedLeadTimes = csvSuppliers.map(s => s.standard_lead_time_days).filter(Boolean).sort((a, b) => a - b);
  const medianLeadTime = sortedLeadTimes[Math.floor(sortedLeadTimes.length / 2)] ?? 30;

  // Significant words (>4 chars) for deduplication
  const sig = name => name.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4);
  const csvNameWords = csvSuppliers.map(s => sig(s.supplier_name ?? ''));

  const seen = new Set();
  const entries = [];

  for (let i = 0; i < liveCandidates.length; i++) {
    const c = liveCandidates[i];
    if (!c.name) continue;

    const cWords = sig(c.name);
    if (!cWords.length) continue;

    // Skip if significant name overlap with any CSV supplier or already in list
    const isDup = csvNameWords.some(csvWords => cWords.some(w => csvWords.includes(w)));
    if (isDup || seen.has(c.name.toLowerCase())) continue;
    seen.add(c.name.toLowerCase());

    const totalPrice = medianUnitPrice * quantity;
    // Normalize Exa score (55–96) → composite_score (0.35–0.65): competitive but below vetted suppliers
    const compositeScore = Math.min(0.65, Math.max(0.35, (c.score - 40) / 100));

    entries.push({
      rank: 99,
      supplier_id: `EXA-${String(i + 1).padStart(3, '0')}`,
      supplier_name: c.name,
      preferred: false,
      incumbent: false,
      pricing_tier_applied: 'Market estimate (unvetted)',
      unit_price: medianUnitPrice,
      total_price: totalPrice,
      currency,
      standard_lead_time_days: medianLeadTime,
      expedited_lead_time_days: medianLeadTime,
      expedited_unit_price: medianUnitPrice,
      expedited_total: totalPrice,
      quality_score: 50,
      risk_score: 50,
      esg_score: 50,
      composite_score: compositeScore,
      score_breakdown: { price: 0.5, lead_time: 0.5, quality: 0.5, risk: 0.5, esg: 0.5, historical: 0, fuzzy_suitability: 0.5 },
      historical_flags: [],
      policy_compliant: null,
      covers_delivery_country: null,
      recommendation_note: 'External candidate from live market search. Pricing is estimated from comparable approved suppliers — obtain RFQ before award.',
      tco: totalPrice,
      tco_breakdown: { base_cost: totalPrice, reliability_cost: 0, lead_time_risk: 0, risk_premium: 0 },
      tco_note: 'Price estimated from approved supplier median. Full TCO requires RFQ.',
      tco_vs_budget_pct: budgetAmount > 0 ? Math.round(((budgetAmount - totalPrice) / budgetAmount) * 100) : null,
      source: 'exa',
      unvetted: true,
      source_url: c.url || null,
    });
  }

  return entries;
}
