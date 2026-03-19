import { NextResponse } from 'next/server';
import { getData, getEligibleSuppliers } from '@/lib/dataLoader';
import { parseRequest } from '@/lib/intakeAgent';
import { checkApprovalTier, checkPreferredSupplier, checkCategoryRules, checkGeographyRules, evaluatePolicy } from '@/lib/policyEngine';
import { scoreSuppliers as newScoreSuppliers } from '@/lib/supplierScorer';
import { buildEscalations } from '@/lib/escalationRouter';
import { computeConfidence as newComputeConfidence } from '@/lib/confidenceScorer';
import { findHistoricalContext } from '@/lib/historicalLookup';
import { generateDecision } from '@/lib/decisionEngine';

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

    // 4. Validate (Initial)
    const issues = [];
    if (!structuredRequest.quantity) issues.push({ id:'V-001', severity:'critical', type:'missing_quantity', description:'Quantity not specified', action:'Provide quantity' });
    if (!structuredRequest.budget_amount) issues.push({ id:'V-002', severity:'critical', type:'missing_budget', description:'Budget not specified', action:'Provide budget' });
    if (structuredRequest.days_until_required !== null && structuredRequest.days_until_required < 10) issues.push({ id:'V-003', severity:'high', type:'lead_time_critical', description:'Delivery deadline is extremely tight', action:'Confirm if deadline is flexible' });

    // 5. Policy
    const totalValue = structuredRequest.budget_amount || 0;
    const approvalTier = checkApprovalTier(totalValue, structuredRequest.currency);
    const preferredCheck = structuredRequest.preferred_supplier_stated ? checkPreferredSupplier(structuredRequest.preferred_supplier_stated, structuredRequest.category_l2, structuredRequest.delivery_countries?.[0] || 'DE') : null;
    const categoryRules = checkCategoryRules(structuredRequest.category_l1, structuredRequest.category_l2);
    const geoRules = checkGeographyRules(structuredRequest.delivery_countries || [], originalRequest?.data_residency_constraint || false);
    const policyResult = { approval_tier: approvalTier, preferred_supplier: preferredCheck, category_rules: categoryRules, geography_rules: geoRules, violations: [] };

    // 6. Score
    const rankedSuppliers = scoreSuppliersLocal(
      structuredRequest.category_l1, 
      structuredRequest.category_l2, 
      structuredRequest.delivery_countries || [], 
      structuredRequest.quantity || 1, 
      structuredRequest.currency || 'EUR',
      originalRequest
    );
    
    // mark incumbent
    rankedSuppliers.forEach(s => {
      if (s.supplier_id === originalRequest?.incumbent_supplier) s.incumbent = true;
    });

    // 6b. Budget Sufficiency Check
    let minimumRequired = null;
    if (rankedSuppliers.length > 0 && structuredRequest.quantity && structuredRequest.budget_amount) {
      const lowestUnitPrice = Math.min(...rankedSuppliers.map(s => s.unit_price));
      minimumRequired = lowestUnitPrice * structuredRequest.quantity;
      if (structuredRequest.budget_amount < minimumRequired) {
        issues.push({
          id: 'V-004',
          severity: 'critical',
          type: 'budget_insufficient',
          description: `Budget of ${structuredRequest.budget_amount} ${structuredRequest.currency} cannot cover ${structuredRequest.quantity} units. Minimum required: ${minimumRequired.toFixed(2)} ${structuredRequest.currency}`,
          action: 'Increase budget or reduce quantity',
          minimum_required: minimumRequired
        });
      }
    }

    const validationResult = { completeness: issues.length === 0 ? 'pass' : 'fail', issues };

    // 7. Historical
    const historicalContext = findHistoricalContext(structuredRequest.category_l2, structuredRequest.delivery_countries || []);

    // 8. Triggers
    const triggers = [];
    if (issues.find(i => i.type === 'missing_budget' || i.type === 'missing_quantity')) triggers.push({ rule:'ER-001', reason:'Missing required info', blocking:true });
    
    if (issues.find(i => i.type === 'budget_insufficient')) {
      triggers.push({ 
        rule: 'ER-001', 
        reason: `Budget of ${structuredRequest.budget_amount} ${structuredRequest.currency} is insufficient. Minimum required: ${minimumRequired?.toFixed(2)} ${structuredRequest.currency}`, 
        blocking: true 
      });
    }

    if (approvalTier && approvalTier.tier >= 2 && structuredRequest.preferred_supplier_stated) {
      const requestText = (text || '').toLowerCase();
      if (requestText.includes('no exception') || requestText.includes('only') || requestText.includes('must use')) {
        triggers.push({ 
          rule: 'ER-002', 
          reason: `Policy AT-00${approvalTier.tier} requires ${approvalTier.quotes_required} quotes. Requester single-supplier instruction cannot override this policy.`, 
          blocking: true 
        });
      }
    }

    if (structuredRequest.days_until_required && rankedSuppliers.length > 0) {
      const fastestExpedited = Math.min(...rankedSuppliers.map(s => s.expedited_lead_time_days || 999));
      if (fastestExpedited > structuredRequest.days_until_required) {
        triggers.push({ 
          rule: 'ER-004', 
          reason: `Required delivery in ${structuredRequest.days_until_required} days but fastest expedited lead time is ${fastestExpedited} days. No supplier can meet this deadline.`, 
          blocking: true 
        });
      }
    }

    if (preferredCheck?.is_restricted) triggers.push({ rule:'ER-002', reason:'Preferred supplier restricted', blocking:true });
    if (rankedSuppliers.length === 0) triggers.push({ rule:'ER-004', reason:'No compliant supplier found', blocking:true });
    if (originalRequest?.data_residency_constraint && geoRules.length > 0) triggers.push({ rule:'ER-005', reason:'Data residency constraint', blocking:true });
    
    const escalations = buildEscalations(triggers);

    // 9. Decision
    const decision = await generateDecision(structuredRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext);

    // 10. Confidence
    const confidence = computeConfidenceLocal(
      validationResult.issues, 
      rankedSuppliers, 
      preferredCheck?.is_preferred && !preferredCheck?.is_restricted, 
      historicalContext.length > 0,
      escalations
    );

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
      request_interpretation: structuredRequest,
      validation: validationResult,
      policy_evaluation: policyResult,
      supplier_shortlist: rankedSuppliers,
      escalations: escalations,
      recommendation: decision,
      audit_trail: {
        policies_checked: ['AT-001','AT-002','AT-003','AT-004','AT-005','ER-001','ER-002','ER-004','ER-005'],
        suppliers_evaluated: rankedSuppliers.map(s => s.supplier_id),
        data_sources_used: ['requests.json','suppliers.csv','pricing.csv','policies.json','historical_awards.csv'],
        historical_awards_consulted: historicalContext.length > 0,
        assumptions: structuredRequest.gaps || [],
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
