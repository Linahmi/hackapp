import { NextResponse } from 'next/server';
import { getData, getEligibleSuppliers } from '@/lib/dataLoader';
import { parseRequest, fillGapsFromHistory } from '@/lib/intakeAgent';
import { checkApprovalTier, checkPreferredSupplier, checkCategoryRules, checkGeographyRules, evaluatePolicy } from '@/lib/policyEngine';
import { scoreSuppliers as newScoreSuppliers } from '@/lib/supplierScorer';
import { buildEscalations } from '@/lib/escalationRouter';
import { computeConfidence as newComputeConfidence } from '@/lib/confidenceScorer';
import { findHistoricalContext } from '@/lib/historicalLookup';
import { generateDecision } from '@/lib/decisionEngine';
import { detectBundlingOpportunity } from '@/lib/bundlingDetector';

// Local proxy functions to bridge the requested step-by-step logic 
// with the existing merged Backend-A native module signatures dynamically.
function scoreSuppliersLocal(l1, l2, countries, qty, currency, originalReq) {
  const eligible = getEligibleSuppliers(l1, l2, countries, qty, currency);
  const fakePolicy = { restricted_suppliers: {} };
  const mockReq = { quantity: qty, currency, days_until_required: 10, incumbent_supplier: originalReq?.incumbent_supplier };
  const { shortlist } = newScoreSuppliers(eligible, fakePolicy, mockReq);
  return shortlist;
}

function computeConfidenceLocal(issues, suppliers, preferredAvailable, historicalMatch, escalations) {
  let score = 100;
  if (issues && issues.length > 0) score -= (20 * issues.length);
  if (!suppliers || suppliers.length === 0) score -= 20;
  
  const hasBlocking = escalations && escalations.some(e => e.blocking);
  if (hasBlocking) score -= 30;

  if (preferredAvailable) score += 10;
  if (historicalMatch) score += 10;
  return Math.min(100, Math.max(0, score));
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { text, request_id } = body;
    
    // 2. Original Request
    const data = getData();
    const originalRequest = (data.requests || []).find(r => r.request_id === request_id) || {};

    // 3. Intake Parsing
    const structuredRequest = await parseRequest(text, originalRequest);

    // 4. Historical (Moved UP)
    const historicalContext = findHistoricalContext(structuredRequest.category_l2, structuredRequest.delivery_countries || []);

    // 4b. Enriched Gap Filling
    const enrichedRequest = fillGapsFromHistory(structuredRequest, historicalContext, structuredRequest.currency || 'EUR');

    // 5. Validate (Initial)
    const issues = [];
    if (!enrichedRequest.quantity) issues.push({ id:'V-001', severity:'critical', type:'missing_quantity', description:'Quantity not specified', action:'Provide quantity' });
    if (!enrichedRequest.budget_amount) issues.push({ id:'V-002', severity:'critical', type:'missing_budget', description:'Budget not specified', action:'Provide budget' });
    if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 10) issues.push({ id:'V-003', severity:'high', type:'lead_time_critical', description:'Delivery deadline is extremely tight', action:'Confirm if deadline is flexible' });

    // 6. Policy
    const totalValue = enrichedRequest.budget_amount || 0;
    const approvalTier = checkApprovalTier(totalValue, enrichedRequest.currency);
    const preferredCheck = enrichedRequest.preferred_supplier_stated ? checkPreferredSupplier(enrichedRequest.preferred_supplier_stated, enrichedRequest.category_l2, enrichedRequest.delivery_countries?.[0] || 'DE') : null;
    const categoryRules = checkCategoryRules(enrichedRequest.category_l1, enrichedRequest.category_l2);
    const geoRules = checkGeographyRules(enrichedRequest.delivery_countries || [], originalRequest?.data_residency_constraint || false);
    const policyResult = { approval_tier: approvalTier, preferred_supplier: preferredCheck, category_rules: categoryRules, geography_rules: geoRules, violations: [] };

    // 7. Score
    const rankedSuppliers = scoreSuppliersLocal(
      enrichedRequest.category_l1, 
      enrichedRequest.category_l2, 
      enrichedRequest.delivery_countries || [], 
      enrichedRequest.quantity || 1, 
      enrichedRequest.currency || 'EUR',
      originalRequest
    );
    
    // mark incumbent
    rankedSuppliers.forEach(s => {
      if (s.supplier_id === originalRequest?.incumbent_supplier) s.incumbent = true;
    });

    // 7b. Budget Sufficiency Check
    let minimumRequired = null;
    if (rankedSuppliers.length > 0 && enrichedRequest.quantity && enrichedRequest.budget_amount) {
      const lowestUnitPrice = Math.min(...rankedSuppliers.map(s => s.unit_price));
      minimumRequired = lowestUnitPrice * enrichedRequest.quantity;
      if (enrichedRequest.budget_amount < minimumRequired) {
        issues.push({
          id: 'V-004',
          severity: 'critical',
          type: 'budget_insufficient',
          description: `Budget of ${enrichedRequest.budget_amount} ${enrichedRequest.currency} cannot cover ${enrichedRequest.quantity} units. Minimum required: ${minimumRequired.toFixed(2)} ${enrichedRequest.currency}`,
          action: 'Increase budget or reduce quantity',
          minimum_required: minimumRequired
        });
      }
    }

    const validationResult = { completeness: issues.length === 0 ? 'pass' : 'fail', issues };

    // 8. Triggers
    const triggers = [];
    if (issues.find(i => i.type === 'missing_budget' || i.type === 'missing_quantity')) triggers.push({ rule:'ER-001', reason:'Missing required info', blocking:true });
    
    if (issues.find(i => i.type === 'budget_insufficient')) {
      triggers.push({ 
        rule: 'ER-001', 
        reason: `Budget of ${enrichedRequest.budget_amount} ${enrichedRequest.currency} is insufficient. Minimum required: ${minimumRequired?.toFixed(2)} ${enrichedRequest.currency}`, 
        blocking: true 
      });
    }

    if (approvalTier && approvalTier.tier >= 2 && enrichedRequest.preferred_supplier_stated) {
      const requestText = (text || '').toLowerCase();
      if (requestText.includes('no exception') || requestText.includes('only') || requestText.includes('must use')) {
        triggers.push({ 
          rule: 'ER-002', 
          reason: `Policy AT-00${approvalTier.tier} requires ${approvalTier.quotes_required} quotes. Requester single-supplier instruction cannot override this policy.`, 
          blocking: true 
        });
      }
    }

    if (enrichedRequest.days_until_required && rankedSuppliers.length > 0) {
      const fastestExpedited = Math.min(...rankedSuppliers.map(s => s.expedited_lead_time_days || 999));
      if (fastestExpedited > enrichedRequest.days_until_required) {
        triggers.push({ 
          rule: 'ER-004', 
          reason: `Required delivery in ${enrichedRequest.days_until_required} days but fastest expedited lead time is ${fastestExpedited} days. No supplier can meet this deadline.`, 
          blocking: true 
        });
      }
    }

    if (preferredCheck?.is_restricted) triggers.push({ rule:'ER-002', reason:'Preferred supplier restricted', blocking:true });
    if (rankedSuppliers.length === 0) triggers.push({ rule:'ER-004', reason:'No compliant supplier found', blocking:true });
    if (originalRequest?.data_residency_constraint && geoRules.length > 0) triggers.push({ rule:'ER-005', reason:'Data residency constraint', blocking:true });
    
    const estimatedSavings = enrichedRequest.budget_amount && rankedSuppliers[0]
      ? Math.max(0, Math.round(enrichedRequest.budget_amount - rankedSuppliers[0].total_price))
      : null;
    const escalations = buildEscalations(triggers, estimatedSavings);

    // 9. Decision
    const decision = await generateDecision(enrichedRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext);

    // 9b. Bundling Detector
    const bundlingOpportunity = detectBundlingOpportunity(enrichedRequest, rankedSuppliers);

    // 10. Confidence
    const confidence = computeConfidenceLocal(
      validationResult.issues, 
      rankedSuppliers, 
      preferredCheck?.is_preferred && !preferredCheck?.is_restricted, 
      historicalContext.length > 0,
      escalations
    );

    const isAutoApproved = escalations.length === 0 && confidence > 70 && (rankedSuppliers[0]?.risk_score || 100) < 30;

    // 11. Return structure
    return NextResponse.json({
      request_id,
      processed_at: new Date().toISOString(),
      confidence_score: confidence,
      steps: [
        { id:'parsing', label:'Reading request', status:'done' },
        { id:'validation', label:'Checking completeness', status:'done' },
        { id:'policy', label:'Applying rules', status:'done' },
        { id:'scoring', label:'Scoring suppliers', status:'done' },
        { id:'decision', label:'Generating decision', status:'done' }
      ],
      request_interpretation: enrichedRequest,
      validation: validationResult,
      policy_evaluation: policyResult,
      supplier_shortlist: rankedSuppliers.map(s => ({
        ...s,
        composite_score_pct: Math.round(s.composite_score * 100)
      })),
      escalations: escalations,
      bundling_opportunity: bundlingOpportunity,
      recommendation: {
        ...decision,
        is_auto_approved: isAutoApproved
      },
      audit_trail: {
        policies_checked: ['AT-001','AT-002','AT-003','AT-004','AT-005','ER-001','ER-002','ER-004','ER-005'],
        suppliers_evaluated: rankedSuppliers.map(s => s.supplier_id),
        data_sources_used: ['requests.json','suppliers.csv','pricing.csv','policies.json','historical_awards.csv'],
        historical_awards_consulted: historicalContext.length > 0,
        assumptions: enrichedRequest.assumptions || [],
        inference_applied: enrichedRequest.assumptions && enrichedRequest.assumptions.length > 0,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
