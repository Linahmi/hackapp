import { getData, getEligibleSuppliers } from '@/lib/dataLoader';
import { parseRequest, fillGapsFromHistory } from '@/lib/intakeAgent';
import { checkApprovalTier, checkPreferredSupplier, checkCategoryRules, checkGeographyRules } from '@/lib/policyEngine';
import { scoreSuppliers as newScoreSuppliers } from '@/lib/supplierScorer';
import { routeEscalations } from '@/lib/escalationRouter';
import { findHistoricalContext } from '@/lib/historicalLookup';
import { generateDecision } from '@/lib/decisionEngine';
import { detectBundlingOpportunity } from '@/lib/bundlingDetector';
import { getNextRequestId, logRequest } from '@/lib/requestCounter';
import { explainConfidence } from '@/lib/confidenceScorer';
// ── Audit & Notifications ────────────────────────────────────────────────────
import { logAuditEvent, AUDIT_EVENTS } from '@/lib/auditLogger';
import { sendApprovalEmail, sendDecisionEmail } from '@/lib/notificationService';
import { scheduleReminder } from '@/lib/reminderService';

const HARD_BLOCK_CASE_TYPES = ['FAILED_IMPOSSIBLE_DATE', 'MORE_INFO_REQUIRED', 'NO_SUPPLIER_AVAILABLE', 'PENDING_RESOLUTION'];

function scoreSuppliersLocal(l1, l2, countries, qty, currency, originalReq, days_until_required, budget_amount, historicalContext) {
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
  const mockReq = { quantity: qty, currency, days_until_required, incumbent_supplier: originalReq?.incumbent_supplier, budget_amount, historicalContext };
  return newScoreSuppliers(eligible, { restricted_suppliers }, mockReq);
}

const delay = (ms) => new Promise(r => setTimeout(r, ms));

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

        // ── AUDIT: request received ──────────────────────────────────────
        logAuditEvent({
          action: AUDIT_EVENTS.REQUEST_RECEIVED,
          requestId: reqId,
          metadata: { text_preview: text?.slice(0, 120) },
        });

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
        const inferredFields = enrichedRequest.assumptions?.length
          ? `Inferred from history: ${enrichedRequest.assumptions.slice(0,2).join(' · ')}`
          : historicalContext.length > 0
          ? `${historicalContext.length} historical award(s) consulted — no gaps to fill`
          : 'No historical context found for this category/region';
        send('step', { step: 'parsing', status: 'done', pct: 20, thinking: `Extracted: ${parsed.category} · qty ${parsed.quantity ?? '?'} · budget ${parsed.budget ?? 'not stated'} · supplier ${parsed.supplier ?? 'none stated'}\n${inferredFields}` });

        // ── AUDIT: parsing completed ─────────────────────────────────────
        logAuditEvent({
          action: AUDIT_EVENTS.REQUEST_PARSED,
          requestId: reqId,
          metadata: {
            category: enrichedRequest.category_l2,
            quantity: enrichedRequest.quantity,
            budget: enrichedRequest.budget_amount,
            currency: enrichedRequest.currency,
            gaps: enrichedRequest.gaps,
            assumptions_applied: (enrichedRequest.assumptions?.length ?? 0) > 0,
          },
        });

        // ── Step 2: Rules Check (40%) ────────────────────────────────
        await delay(1000); // min delay so users see each step
        const rulesChecking = [
          `Approval tier: ${enrichedRequest.budget_amount ? `${enrichedRequest.currency ?? 'EUR'} ${enrichedRequest.budget_amount?.toLocaleString()}` : 'budget unknown'}`,
          enrichedRequest.preferred_supplier_stated ? `Preferred supplier: ${enrichedRequest.preferred_supplier_stated}` : 'No preferred supplier stated',
          enrichedRequest.days_until_required != null ? `Delivery: ${enrichedRequest.days_until_required} days` : 'No delivery date',
          `Countries: ${(enrichedRequest.delivery_countries ?? []).join(', ') || 'not specified'}`,
        ].join(' · ');
        send('step', { step: 'rules', status: 'active', pct: 25, thinking: `Checking compliance rules…\n${rulesChecking}` });

        const issues = [];
        if (structuredRequest.demand_reframe_flag) issues.push({ issue_id:'V-000', severity:'warning', type:'contradictory_request', description:'Request contains contradictory or unreasonable information — AI flagged this for review', action_required:'Clarify the request before proceeding' });
        if (!enrichedRequest.quantity || enrichedRequest.quantity <= 0) issues.push({ issue_id:'V-001', severity:'critical', type:'missing_quantity', description:'Quantity not specified or invalid (must be > 0)', action_required:'Provide a valid quantity' });
        if (!enrichedRequest.budget_amount) issues.push({ issue_id:'V-002', severity:'critical', type:'missing_budget', description:'Budget not specified', action_required:'Provide budget' });
        if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 0) issues.push({ issue_id:'V-003', severity:'critical', type:'deadline_passed', description:`Requested delivery date is in the past (${Math.abs(enrichedRequest.days_until_required)} days ago)`, action_required:'Provide a valid future delivery date' });
        else if (enrichedRequest.days_until_required !== null && enrichedRequest.days_until_required < 10) issues.push({ issue_id:'V-003', severity:'high', type:'lead_time_critical', description:'Delivery deadline is extremely tight', action_required:'Confirm if deadline is flexible' });

        const totalValue = enrichedRequest.budget_amount || 0;
        const approvalThreshold = checkApprovalTier(totalValue, enrichedRequest.currency);
        const preferredCheck = enrichedRequest.preferred_supplier_stated ? checkPreferredSupplier(enrichedRequest.preferred_supplier_stated, enrichedRequest.category_l2, enrichedRequest.delivery_countries?.[0] || 'DE') : null;
        const categoryRules = checkCategoryRules(enrichedRequest.category_l1, enrichedRequest.category_l2);
        const geoRules = checkGeographyRules(enrichedRequest.delivery_countries || [], originalRequest?.data_residency_constraint || false);
        const policyResult = { approval_threshold: approvalThreshold, preferred_supplier: preferredCheck, category_rules: categoryRules, geography_rules: geoRules, violations: [] };

        await delay(800);
        const tierLabel = approvalThreshold ? `Approval tier: ${approvalThreshold.rule_applied} (${approvalThreshold.quotes_required} quote(s) required)` : 'Tier: below threshold';
        const rulesSummary = issues.length === 0
          ? `All compliance checks passed ✓ · ${tierLabel}`
          : `${issues.length} issue(s) found · ${issues.map(i => i.description).join(' · ')} · ${tierLabel}`;
        send('step', { step: 'rules', status: 'done', pct: 40, thinking: rulesSummary });

        // ── Step 3: Scoring (60%) ────────────────────────────────────
        await delay(1000);
        const eligibleCount = getEligibleSuppliers(
          enrichedRequest.category_l1, enrichedRequest.category_l2,
          enrichedRequest.delivery_countries || [], enrichedRequest.quantity > 0 ? enrichedRequest.quantity : 1, enrichedRequest.currency || 'EUR'
        ).length;
        send('step', { step: 'scoring', status: 'active', pct: 45, thinking: `Found ${eligibleCount} eligible supplier(s) for ${enrichedRequest.category_l2 ?? enrichedRequest.category_l1 ?? 'this category'} in [${(enrichedRequest.delivery_countries ?? []).join(', ')}] · Scoring on price (30%), lead time (30%), quality (20%), risk (10%), ESG (10%)…` });

        const { shortlist: rankedSuppliers, excluded: excludedSuppliers } = scoreSuppliersLocal(
          enrichedRequest.category_l1, enrichedRequest.category_l2,
          enrichedRequest.delivery_countries || [],
          (enrichedRequest.quantity > 0 ? enrichedRequest.quantity : 1), enrichedRequest.currency || 'EUR',
          originalRequest, enrichedRequest.days_until_required, enrichedRequest.budget_amount, historicalContext
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
            issues.push({ issue_id:'V-004', severity:'critical', type:'budget_insufficient', description:`Budget of ${enrichedRequest.budget_amount} ${enrichedRequest.currency} cannot cover ${enrichedRequest.quantity} units. Minimum required: ${minimumRequired.toFixed(2)} ${enrichedRequest.currency}`, action_required:'Increase budget or reduce quantity', minimum_required: minimumRequired });
          }
        }

        const validationResult = { completeness: issues.length === 0 ? 'pass' : 'fail', issues };

        await delay(800);
        const scoringSummary = rankedSuppliers.length > 0
          ? `Ranked ${rankedSuppliers.length} supplier(s)${excludedSuppliers?.length ? ` · ${excludedSuppliers.length} excluded` : ''} · #1: ${rankedSuppliers[0].supplier_name} — score ${Math.round(rankedSuppliers[0].composite_score * 100)}/100, ${rankedSuppliers[0].unit_price?.toLocaleString()} ${enrichedRequest.currency ?? 'EUR'}/unit, lead time ${rankedSuppliers[0].standard_lead_time_days}d`
          : `No eligible suppliers found for ${enrichedRequest.category_l2 ?? 'this category'} in [${(enrichedRequest.delivery_countries ?? []).join(', ')}]`;
        send('step', { step: 'scoring', status: 'done', pct: 60, thinking: scoringSummary });

        // ── AUDIT: suppliers scored ──────────────────────────────────────
        logAuditEvent({
          action: rankedSuppliers.length > 0 ? AUDIT_EVENTS.SUPPLIERS_SCORED : AUDIT_EVENTS.NO_SUPPLIER_FOUND,
          requestId: reqId,
          metadata: {
            shortlisted: rankedSuppliers.length,
            excluded: excludedSuppliers?.length ?? 0,
            top_supplier: rankedSuppliers[0]?.supplier_name ?? null,
            top_score: rankedSuppliers[0] ? Math.round(rankedSuppliers[0].composite_score * 100) : null,
          },
        });

        // ── Step 4: Decision (85%) ───────────────────────────────────
        await delay(800);
        send('step', { step: 'decision', status: 'active', pct: 65, thinking: 'Generating sourcing recommendation — weighing compliance, pricing, risk, and delivery feasibility…' });

        // Enrich validation issues with lead-time infeasibility (needs rankedSuppliers)
        if (enrichedRequest.days_until_required && rankedSuppliers.length > 0) {
          const fastestExpedited = Math.min(...rankedSuppliers.map(s => s.expedited_lead_time_days || 999));
          if (fastestExpedited > enrichedRequest.days_until_required) {
            issues.push({ issue_id:'V-005', severity:'critical', type:'lead_time_infeasible', description:`Required in ${enrichedRequest.days_until_required} days but fastest supplier delivers in ${fastestExpedited} days.`, action_required:'Negotiate expedited delivery or revise deadline' });
          }
        }
        // Policy conflict (single-supplier override attempt)
        if (approvalThreshold && approvalThreshold.tier >= 2 && enrichedRequest.preferred_supplier_stated) {
          const requestText = (originalRequest?.request_text || text || '').toLowerCase();
          if (requestText.includes('no exception') || requestText.includes('only') || requestText.includes('must use')) {
            issues.push({ issue_id:'V-006', severity:'high', type:'policy_conflict', description:`Policy ${approvalThreshold.rule_applied} requires ${approvalThreshold.quotes_required} quotes. Single-supplier instruction cannot override.` });
          }
        }

        // ── Case type ────────────────────────────────────────────────
        const hasImpossibleDate = issues.some(i => i.type === 'deadline_passed' || i.type === 'lead_time_infeasible');
        const hasUnclearIntent  = structuredRequest.unclear_intent === true || (!enrichedRequest.category_l2 && !enrichedRequest.category_l1);
        const hasBudgetIssue = issues.some(i => i.type === 'budget_insufficient');
        let case_type;
        if      (hasImpossibleDate)                                            case_type = 'FAILED_IMPOSSIBLE_DATE';
        else if (hasUnclearIntent)                                             case_type = 'MORE_INFO_REQUIRED';
        else if (hasBudgetIssue)                                               case_type = 'PENDING_RESOLUTION';
        else if (rankedSuppliers.length === 0)                                 case_type = 'NO_SUPPLIER_AVAILABLE';
        else if (structuredRequest.demand_reframe_flag && rankedSuppliers.length > 0) case_type = 'SIMILAR_NOT_EXACT_MATCH';
        else                                                                   case_type = 'READY_FOR_VALIDATION';

        const enrichedForEscalation = {
          ...enrichedRequest,
          data_residency_constraint: originalRequest?.data_residency_constraint,
          esg_requirement: originalRequest?.esg_requirement,
        };

        const escalations = routeEscalations(validationResult, policyResult, rankedSuppliers, enrichedForEscalation);

        const estimatedSavings = enrichedRequest.budget_amount && rankedSuppliers[0]
          ? Math.max(0, Math.round(enrichedRequest.budget_amount - rankedSuppliers[0].total_price))
          : null;
        escalations.forEach(e => { e.estimated_savings = estimatedSavings; });

        // ER-003: inject approval-tier sign-off escalation for tier >= 2 if not already present
        const TIER_ESCALATION_TARGETS = { 2: 'Procurement Manager', 3: 'Head of Category', 4: 'Head of Strategic Sourcing', 5: 'CPO' };
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

        // ── Priority enforcement ──────────────────────────────────────
        // Hard blocks are mutually exclusive with optimization signals.
        // On a hard block: keep only the blocking escalations that caused it;
        // suppress all non-blocking noise (approvals, savings, bundling).
        const isHardBlock = HARD_BLOCK_CASE_TYPES.includes(case_type);
        if (isHardBlock) {
          escalations.splice(0, escalations.length, ...escalations.filter(e => e.blocking));
        }

        const blockingCount = escalations.filter(e => e.blocking).length;
        const caseTypeLabel = {
          READY_FOR_VALIDATION:  'Ready for validation',
          FAILED_IMPOSSIBLE_DATE:'Blocked — impossible deadline',
          MORE_INFO_REQUIRED:    'Blocked — unclear request',
          PENDING_RESOLUTION:    'Blocked — pending resolution',
          NO_SUPPLIER_AVAILABLE: 'Blocked — no compliant supplier',
          SIMILAR_NOT_EXACT_MATCH: 'Partial match — demand reframed',
        }[case_type] ?? case_type;
        let decisionThinking = `Case type: ${caseTypeLabel} · ${blockingCount} blocking escalation(s) · ${rankedSuppliers.length} supplier(s) shortlisted\n\n`;
        send('step', { step: 'decision', status: 'active', pct: 65, thinking: decisionThinking });

        const decision = await generateDecision(enrichedRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext, (chunk) => {
          decisionThinking += chunk;
          send('step', { step: 'decision', status: 'active', pct: 75, thinking: decisionThinking });
        });

        if (decision.status === 'cannot_proceed' && case_type === 'READY_FOR_VALIDATION') {
          case_type = 'PENDING_RESOLUTION';
        }

        // Bundling requires a valid shortlist — never run when no compliant supplier exists
        const bundlingOpportunity = (!isHardBlock && rankedSuppliers.length > 0)
          ? detectBundlingOpportunity(enrichedRequest, rankedSuppliers)
          : null;

        const decisionDone = decision.status === 'recommended'
          ? `✓ Recommending ${decision.preferred_supplier_if_resolved || rankedSuppliers[0]?.supplier_name} — ${decision.decision_summary ?? ''}`
          : `✗ Cannot proceed — ${escalations.filter(e=>e.blocking).map(e=>e.rule).join(', ')} · ${decision.decision_summary ?? 'manual intervention required'}`;
        send('step', { step: 'decision', status: 'done', pct: 85, thinking: decisionDone });

        // ── AUDIT: escalations raised (if any) ───────────────────────────
        if (escalations.length > 0) {
          logAuditEvent({
            action: AUDIT_EVENTS.ESCALATION_RAISED,
            requestId: reqId,
            metadata: {
              count: escalations.length,
              blocking: escalations.filter(e => e.blocking).length,
              escalated_to: escalations.map(e => e.escalate_to),
              rules: escalations.map(e => e.rule),
            },
          });
        }

        // ── AUDIT: decision generated ────────────────────────────────────
        logAuditEvent({
          action: AUDIT_EVENTS.DECISION_GENERATED,
          requestId: reqId,
          metadata: {
            case_type,
            decision_status: decision.status,
            top_supplier: rankedSuppliers[0]?.supplier_name ?? null,
          },
        });

        // ── Step 5: Logged (100%) ────────────────────────────────────
        await delay(600);
        send('step', { step: 'logged', status: 'active', pct: 90, thinking: 'Writing audit trail and computing confidence score…' });

        // Auto-approve ONLY when: tier 1, no escalations, no critical validation issues
        const hasBlockingValidationIssue = issues.some(i => i.severity === 'critical');
        const isAutoApproved =
          approvalThreshold?.tier === 1 &&
          escalations.length === 0 &&
          !hasBlockingValidationIssue;

        // Determine required approver based on the highest escalation level, or fall back to the approval tier
        let requiredApprover = null;
        if (!isAutoApproved) {
          if (escalations.length > 0) {
            const sorted = [...escalations].sort((a, b) => (b.hierarchy_level || 0) - (a.hierarchy_level || 0));
            requiredApprover = sorted[0].escalate_to;
          } else {
            requiredApprover = approvalThreshold?.approver || approvalThreshold?.approvers?.[0] || 'Procurement Manager';
          }
        }

        const confidenceResult = explainConfidence(
          enrichedRequest,
          validationResult,
          policyResult,
          rankedSuppliers,
          escalations,
          { ...decision, is_auto_approved: isAutoApproved }
        );
        const confidence = confidenceResult.score;

        await delay(500);
        const loggedDone = isAutoApproved
          ? `Confidence: ${confidence}% · Auto-approved ✓ · Audit trail written · ${rankedSuppliers.length} supplier(s) evaluated`
          : `Confidence: ${confidence}% · Requires sign-off from ${requiredApprover} · ${escalations.length} escalation(s) raised · Audit trail written`;
        send('step', { step: 'logged', status: 'done', pct: 100, thinking: loggedDone });

        // ── Final result ─────────────────────────────────────────────
        const result = {
          request_id: reqId,
          processed_at: new Date().toISOString(),
          confidence_score: confidence,
          confidence_details: confidenceResult.drivers,
          request_interpretation: enrichedRequest,
          validation: validationResult,
          policy_evaluation: policyResult,
          supplier_shortlist: rankedSuppliers.map(s => ({ ...s, composite_score_pct: Math.round(s.composite_score * 100) })),
          suppliers_excluded: excludedSuppliers ?? [],
          escalations,
          bundling_opportunity: bundlingOpportunity,
          case_type,
          recommendation: {
            ...decision,
            is_auto_approved: isAutoApproved,
            required_approver: requiredApprover,
            minimum_budget_required: minimumRequired,
            minimum_budget_currency: minimumRequired ? (enrichedRequest.currency ?? 'EUR') : null,
            savings_vs_budget_pct: (enrichedRequest.budget_amount && rankedSuppliers[0]?.total_price)
              ? Math.round(((enrichedRequest.budget_amount - rankedSuppliers[0].total_price) / enrichedRequest.budget_amount) * 100)
              : null,
          },
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

        // ── AUDIT: auto-approved or approval required ────────────────────
        logAuditEvent({
          action: isAutoApproved ? AUDIT_EVENTS.AUTO_APPROVED : AUDIT_EVENTS.APPROVAL_REQUIRED,
          requestId: reqId,
          metadata: {
            confidence,
            required_approver: requiredApprover ?? null,
            escalation_count: escalations.length,
          },
        });

        // ── NOTIFICATIONS ────────────────────────────────────────────────
        // Build a short summary string used in both emails
        const _summary = [
          enrichedRequest.quantity, '×', enrichedRequest.category_l2,
          '·', enrichedRequest.currency, enrichedRequest.budget_amount?.toLocaleString(),
        ].filter(Boolean).join(' ');

        // Always notify requester of the outcome (placeholder email until auth is ready)
        await sendDecisionEmail({
          to:              'requester@company.com',
          requestId:       reqId,
          summary:         _summary,
          status:          decision.status,
          aiDecision:      decision.decision_summary ?? '',
          justification:   decision.justification ?? '',
          topSupplier:     rankedSuppliers[0]?.supplier_name,
          confidenceScore: confidence,
        });

        // If approval is needed: notify the approver and schedule a reminder
        if (!isAutoApproved && requiredApprover) {
          await sendApprovalEmail({
            to:            'approver@company.com',
            requestId:     reqId,
            approverName:  requiredApprover,
            summary:       _summary,
            aiDecision:    decision.decision_summary ?? '',
            justification: decision.justification ?? '',
            escalations,
          });

          scheduleReminder({
            requestId:     reqId,
            approverEmail: 'approver@company.com',
            approverName:  requiredApprover,
            summary:       _summary,
          });
        }

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
