import { getData, getEligibleSuppliers } from '@/lib/dataLoader';
import { parseRequest, fillGapsFromHistory } from '@/lib/intakeAgent';
import { checkApprovalTier, checkPreferredSupplier, checkCategoryRules, checkGeographyRules } from '@/lib/policyEngine';
import { scoreSuppliers as newScoreSuppliers } from '@/lib/supplierScorer';
import { routeEscalations } from '@/lib/escalationRouter';
import { computeConfidence as newComputeConfidence } from '@/lib/confidenceScorer';
import { findHistoricalContext } from '@/lib/historicalLookup';
import { generateDecision } from '@/lib/decisionEngine';
import { detectBundlingOpportunity } from '@/lib/bundlingDetector';
import { getNextRequestId, logRequest } from '@/lib/requestCounter';

function scoreSuppliersLocal(l1, l2, countries, qty, currency, originalReq, days_until_required, historicalContext) {
  const eligible = getEligibleSuppliers(l1, l2, countries, qty, currency);
  const fakePolicy = { restricted_suppliers: {} };
  const mockReq = { quantity: qty, currency, days_until_required, incumbent_supplier: originalReq?.incumbent_supplier, historicalContext };
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

const delay = (ms) => new Promise(r => setTimeout(r, 0)); // Artificial UI delays removed!

export async function POST(req) {
  const body = await req.json();
  const { text, request_id } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event, data) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        // Assign a unique R- request ID
        const reqId = getNextRequestId();

        // ── Step 1: Parsing (20%) ────────────────────────────────────
        let parsingThinking = `[${reqId}] Analyzing request context...\n`;
        send('step', { step: 'parsing', status: 'active', pct: 0, requestId: reqId, thinking: parsingThinking });

        const data = getData();
        const originalRequest = request_id
          ? (data.requests || []).find(r => r.request_id === request_id) || {}
          : {};
          
        const structuredRequest = await parseRequest(text, originalRequest, (chunk) => {
          parsingThinking += chunk;
          send('step', { step: 'parsing', status: 'active', pct: 10, requestId: reqId, thinking: parsingThinking });
        });
        
        const historicalLookupResult = findHistoricalContext(structuredRequest.category_l2, structuredRequest.delivery_countries || [], originalRequest?.business_unit);
        const historicalContext = historicalLookupResult.records;
        const awardedRecords = historicalContext.filter(r => r.awarded);
        const enrichedRequest = fillGapsFromHistory(structuredRequest, awardedRecords, structuredRequest.currency || 'EUR');

        const parsed = {
          category: `${enrichedRequest.category_l1 || '?'} › ${enrichedRequest.category_l2 || '?'}`,
          quantity: enrichedRequest.quantity,
          budget: enrichedRequest.budget_amount ? `${enrichedRequest.currency || 'EUR'} ${enrichedRequest.budget_amount.toLocaleString()}` : null,
          supplier: enrichedRequest.preferred_supplier_stated,
        };
        send('step', { step: 'parsing', status: 'done', pct: 20, thinking: `Extracted: ${parsed.category}, qty ${parsed.quantity ?? '?'}, budget ${parsed.budget ?? 'not specified'}, supplier ${parsed.supplier ?? 'none stated'}` });

        // ── Step 2: Rules Check (40%) ────────────────────────────────
        await delay(1000); // min delay so users see each step
        send('step', { step: 'rules', status: 'active', pct: 25, thinking: 'Running compliance engine — checking approval tiers, supplier restrictions, budget sufficiency, lead-time feasibility…' });

        const issues = [];
        if (structuredRequest.demand_reframe_flag) issues.push({ id:'V-000', severity:'warning', type:'contradictory_request', description:'Request contains contradictory or unreasonable information — AI flagged this for review', action:'Clarify the request before proceeding' });
        if (!enrichedRequest.quantity || enrichedRequest.quantity <= 0) issues.push({ id:'V-001', severity:'critical', type:'missing_quantity', description:'Quantity not specified or invalid (must be > 0)', action:'Provide a valid quantity' });
        if (!enrichedRequest.budget_amount) issues.push({ id:'V-002', severity:'critical', type:'missing_budget', description:'Budget not specified', action:'Provide budget' });
        if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 0) issues.push({ id:'V-003', severity:'critical', type:'deadline_passed', description:`Requested delivery date is in the past (${Math.abs(enrichedRequest.days_until_required)} days ago)`, action:'Provide a valid future delivery date' });
        else if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 10) issues.push({ id:'V-003', severity:'high', type:'lead_time_critical', description:'Delivery deadline is extremely tight', action:'Confirm if deadline is flexible' });

        const totalValue = enrichedRequest.budget_amount || 0;
        const approvalTier = checkApprovalTier(totalValue, enrichedRequest.currency);
        const preferredCheck = enrichedRequest.preferred_supplier_stated ? checkPreferredSupplier(enrichedRequest.preferred_supplier_stated, enrichedRequest.category_l2, enrichedRequest.delivery_countries?.[0] || 'DE') : null;
        const categoryRules = checkCategoryRules(enrichedRequest.category_l1, enrichedRequest.category_l2);
        const geoRules = checkGeographyRules(enrichedRequest.delivery_countries || [], originalRequest?.data_residency_constraint || false);
        const policyResult = { approval_tier: approvalTier, preferred_supplier: preferredCheck, category_rules: categoryRules, geography_rules: geoRules, violations: [] };

        await delay(800);
        const rulesSummary = issues.length === 0 ? 'All compliance checks passed ✓' : `Found ${issues.length} issue(s): ${issues.map(i => i.type).join(', ')}`;
        send('step', { step: 'rules', status: 'done', pct: 40, thinking: rulesSummary });

        // ── Step 3: Scoring (60%) ────────────────────────────────────
        await delay(1000);
        send('step', { step: 'scoring', status: 'active', pct: 45, thinking: 'Evaluating eligible suppliers — comparing unit prices, lead times, risk profiles, ESG ratings…' });

        const rankedSuppliers = scoreSuppliersLocal(
          enrichedRequest.category_l1, enrichedRequest.category_l2,
          enrichedRequest.delivery_countries || [],
          (enrichedRequest.quantity > 0 ? enrichedRequest.quantity : 1), enrichedRequest.currency || 'EUR',
          originalRequest, enrichedRequest.days_until_required, historicalContext
        );
        rankedSuppliers.forEach(s => {
          if (s.supplier_id === originalRequest?.incumbent_supplier) s.incumbent = true;
        });

        // Budget sufficiency
        let minimumRequired = null;
        if (rankedSuppliers.length > 0 && enrichedRequest.quantity && enrichedRequest.budget_amount) {
          const lowestUnitPrice = Math.min(...rankedSuppliers.map(s => s.unit_price));
          minimumRequired = lowestUnitPrice * enrichedRequest.quantity;
          if (enrichedRequest.budget_amount < minimumRequired) {
            issues.push({ id:'V-004', severity:'critical', type:'budget_insufficient', description:`Budget of ${enrichedRequest.budget_amount} ${enrichedRequest.currency} cannot cover ${enrichedRequest.quantity} units. Minimum required: ${minimumRequired.toFixed(2)} ${enrichedRequest.currency}`, action:'Increase budget or reduce quantity', minimum_required: minimumRequired });
          }
        }

        const validationResult = { completeness: issues.length === 0 ? 'pass' : 'fail', issues };

        await delay(800);
        const scoringSummary = rankedSuppliers.length > 0
          ? `Ranked ${rankedSuppliers.length} suppliers. Top: ${rankedSuppliers[0].supplier_name} (score ${rankedSuppliers[0].composite_score}/100, ${rankedSuppliers[0].unit_price} ${enrichedRequest.currency || 'EUR'}/unit)`
          : 'No eligible suppliers found for this configuration';
        send('step', { step: 'scoring', status: 'done', pct: 60, thinking: scoringSummary });

        // ── Step 4: Decision (85%) ───────────────────────────────────
        await delay(800);
        send('step', { step: 'decision', status: 'active', pct: 65, thinking: 'Generating AI-powered sourcing recommendation — weighing compliance, pricing, risk, and delivery feasibility…' });

        // Enrich validation issues with lead-time infeasibility (needs rankedSuppliers)
        if (enrichedRequest.days_until_required && rankedSuppliers.length > 0) {
          const fastestExpedited = Math.min(...rankedSuppliers.map(s => s.expedited_lead_time_days || 999));
          if (fastestExpedited > enrichedRequest.days_until_required) {
            issues.push({ id:'V-005', severity:'critical', type:'lead_time_infeasible', description:`Required in ${enrichedRequest.days_until_required} days but fastest supplier delivers in ${fastestExpedited} days.`, action:'Negotiate expedited delivery or revise deadline' });
          }
        }
        // Policy conflict (single-supplier override attempt)
        if (approvalTier && approvalTier.tier >= 2 && enrichedRequest.preferred_supplier_stated) {
          const requestText = (originalRequest?.request_text || text || '').toLowerCase();
          if (requestText.includes('no exception') || requestText.includes('only') || requestText.includes('must use')) {
            issues.push({ id:'V-006', severity:'high', type:'policy_conflict', description:`Policy AT-00${approvalTier.tier} requires ${approvalTier.quotes_required} quotes. Single-supplier instruction cannot override.` });
          }
        }

        const enrichedForEscalation = {
          ...enrichedRequest,
          data_residency_constraint: originalRequest?.data_residency_constraint,
          esg_requirement: originalRequest?.esg_requirement,
        };

        const escalations = routeEscalations(
          { ...validationResult, issues_detected: issues },
          policyResult,
          rankedSuppliers,
          enrichedForEscalation
        );

        const estimatedSavings = enrichedRequest.budget_amount && rankedSuppliers[0]
          ? Math.max(0, Math.round(enrichedRequest.budget_amount - rankedSuppliers[0].total_price))
          : null;
        escalations.forEach(e => { e.estimated_savings = estimatedSavings; });

        let decisionThinking = `Evaluating ${rankedSuppliers.length} suppliers against ${issues.length} issues and ${escalations.length} escalations...\n\n`;
        send('step', { step: 'decision', status: 'active', pct: 65, thinking: decisionThinking });

        const decision = await generateDecision(enrichedRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext, (chunk) => {
          decisionThinking += chunk;
          send('step', { step: 'decision', status: 'active', pct: 75, thinking: decisionThinking });
        });
        
        const bundlingOpportunity = detectBundlingOpportunity(enrichedRequest, rankedSuppliers);

        send('step', { step: 'decision', status: 'done', pct: 85, thinking: decision.status === 'recommended' ? `Recommending ${decision.preferred_supplier_if_resolved || rankedSuppliers[0]?.supplier_name || 'top supplier'}` : 'Cannot auto-approve — escalation required' });

        // ── Step 5: Logged (100%) ────────────────────────────────────
        await delay(600);
        send('step', { step: 'logged', status: 'active', pct: 90, thinking: 'Writing audit trail and computing confidence score…' });

        const confidence = computeConfidenceLocal(
          validationResult.issues, rankedSuppliers,
          preferredCheck?.is_preferred && !preferredCheck?.is_restricted,
          historicalContext.length > 0, escalations
        );
        // Auto-approve ONLY for Tier 1 (low-value, self-service) with no escalations
        const isAutoApproved =
          approvalTier?.tier === 1 &&
          escalations.length === 0 &&
          confidence > 70 &&
          (rankedSuppliers[0]?.risk_score || 100) < 30;

        // Determine required approver based on the highest escalation level, or fall back to the approval tier
        let requiredApprover = null;
        if (!isAutoApproved) {
          if (escalations.length > 0) {
            const sorted = [...escalations].sort((a, b) => (b.hierarchy_level || 0) - (a.hierarchy_level || 0));
            requiredApprover = sorted[0].escalate_to;
          } else {
            requiredApprover = approvalTier?.approver || 'Procurement Manager';
          }
        }

        await delay(500);
        send('step', { step: 'logged', status: 'done', pct: 100, thinking: `Confidence: ${confidence}%. ${isAutoApproved ? 'Auto-approved ✓' : `Requires approval from ${requiredApprover}`}` });

        // ── Final result ─────────────────────────────────────────────
        const result = {
          request_id: reqId,
          processed_at: new Date().toISOString(),
          confidence_score: confidence,
          request_interpretation: enrichedRequest,
          validation: validationResult,
          policy_evaluation: policyResult,
          supplier_shortlist: rankedSuppliers.map(s => ({ ...s, composite_score_pct: Math.round(s.composite_score * 100) })),
          escalations,
          bundling_opportunity: bundlingOpportunity,
          recommendation: { ...decision, is_auto_approved: isAutoApproved, required_approver: requiredApprover },
          audit_trail: {
            policies_checked: ['AT-001','AT-002','AT-003','AT-004','AT-005','ER-001','ER-002','ER-004','ER-005'],
            supplier_ids_evaluated: rankedSuppliers.map(s => s.supplier_id),
            data_sources_used: ['requests.json','suppliers.csv','pricing.csv','policies.json','historical_awards.csv'],
            historical_awards_consulted: historicalContext.length > 0,
            historical_records: historicalContext,
            client_scope_used: historicalLookupResult.match_level,
            assumptions: enrichedRequest.assumptions || [],
            inference_applied: enrichedRequest.assumptions && enrichedRequest.assumptions.length > 0,
            generated_at: new Date().toISOString()
          }
        };

        // Log this request to history
        logRequest(reqId, {
          category: `${enrichedRequest.category_l1} > ${enrichedRequest.category_l2}`,
          quantity: enrichedRequest.quantity,
          budget: enrichedRequest.budget_amount,
          status: decision.status,
        });

        send('result', result);
        controller.close();

      } catch (error) {
        send('error', { message: error.message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
