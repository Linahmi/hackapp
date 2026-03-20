/**
 * Build structured decision output from the actual computed pipeline state.
 * Returns { decision_summary, justification, next_action, key_reasons, risks }.
 */
function buildMockDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest) {
  const issues = validationResult?.issues ?? [];
  const blockingEscs = escalations.filter(e => e.blocking);
  const top = rankedSuppliers[0];

  // ── READY_FOR_VALIDATION ─────────────────────────────────────────────────────
  if (!hasBlocking && top) {
    return {
      status: 'recommended',
      decision_summary: `${top.supplier_name} is recommended as the best-value compliant option.`,
      justification: `Ranked first with a composite score of ${Math.round((top.composite_score ?? 0) * 100)}/100, offering the strongest balance of price (${top.unit_price} ${structuredRequest.currency}/unit), lead time (${top.standard_lead_time_days} days), and compliance. Budget is sufficient and delivery is feasible within the required window.`,
      next_action: 'Client to validate the order — no further approvals required.',
      key_reasons: [
        `Best composite score: ${Math.round((top.composite_score ?? 0) * 100)}/100`,
        `Unit price: ${top.unit_price} ${structuredRequest.currency}`,
        `Lead time: ${top.standard_lead_time_days} days`,
      ],
      risks: ['Monitor supplier capacity before final award', 'Verify warranty terms before signature'],
    };
  }

  // ── FAILED_IMPOSSIBLE_DATE ───────────────────────────────────────────────────
  const infeasible = issues.find(i => i.type === 'lead_time_infeasible');
  const deadlinePassed = issues.find(i => i.type === 'deadline_passed');
  if (infeasible || deadlinePassed) {
    const detail = infeasible?.description ?? deadlinePassed?.description ?? 'The requested delivery date cannot be met.';
    return {
      status: 'cannot_proceed',
      decision_summary: 'This request cannot proceed — the delivery deadline is not achievable.',
      justification: `${detail} No supplier in the approved panel can fulfill this requirement within the requested window, even on an expedited basis.`,
      next_action: 'Intern / Sourcing Agent to contact the requester to negotiate a revised delivery date or confirm whether flexibility is available.',
      key_reasons: ['Delivery deadline infeasible', 'No expedited option available'],
      risks: ['Deadline must be renegotiated before resubmission'],
    };
  }

  // ── MORE_INFO_REQUIRED ───────────────────────────────────────────────────────
  const missingFields = issues.filter(i => ['missing_quantity', 'missing_budget', 'missing_field'].includes(i.type));
  if (missingFields.length > 0 || (!structuredRequest.category_l1 && !structuredRequest.category_l2)) {
    const fields = missingFields.map(i => i.type.replace('missing_', '')).join(', ') || 'category, quantity';
    return {
      status: 'cannot_proceed',
      decision_summary: 'This request cannot be processed — critical information is missing.',
      justification: `The request is missing required procurement fields: ${fields}. Without this data, supplier matching and compliance checks cannot be completed. The request must be resubmitted with complete information.`,
      next_action: 'Intern / Sourcing Agent to contact the requester and collect the missing information before resubmission.',
      key_reasons: [`Missing: ${fields}`],
      risks: ['Request on hold until missing fields are provided'],
    };
  }

  // ── BUDGET_INSUFFICIENT ──────────────────────────────────────────────────────
  const budgetIssue = issues.find(i => i.type === 'budget_insufficient');
  if (budgetIssue) {
    return {
      status: 'cannot_proceed',
      decision_summary: 'This request cannot proceed — the stated budget is insufficient.',
      justification: `${budgetIssue.description} The lowest compliant offer exceeds the approved budget. An increase or quantity reduction is required before sourcing can continue.`,
      next_action: 'Client to revise the budget or reduce quantity, then resubmit.',
      key_reasons: ['Budget below minimum required', 'No supplier within budget range'],
      risks: ['Budget must be increased or quantity reduced before re-submission'],
    };
  }

  // ── NO_SUPPLIER_AVAILABLE ────────────────────────────────────────────────────
  if (rankedSuppliers.length === 0) {
    return {
      status: 'cannot_proceed',
      decision_summary: 'No compliant supplier is available for this requirement.',
      justification: `No supplier in the approved panel covers this category and delivery region with the specified constraints. Existing framework agreements do not extend to this scope.`,
      next_action: 'Sourcing Specialist to identify and qualify a new supplier or escalate to category management.',
      key_reasons: ['No approved panel supplier matched', 'Scope outside existing framework'],
      risks: ['New supplier onboarding required', 'Timeline impact likely'],
    };
  }

  // ── POLICY / APPROVAL TIER ───────────────────────────────────────────────────
  const unapproved = blockingEscs.find(e => e.rule === 'ER-002');
  const tierEsc = blockingEscs.find(e => e.rule === 'ER-003');
  const policyConflict = issues.find(i => i.type === 'policy_conflict');

  const parts = [];
  if (unapproved) parts.push(`The preferred supplier is not on the approved panel and cannot be awarded without prior qualification.`);
  if (policyConflict) parts.push(`A single-supplier instruction was detected but policy requires competitive quoting at this approval tier.`);
  if (tierEsc) parts.push(`Contract value triggers a mandatory ${tierEsc.escalate_to} sign-off before sourcing can proceed.`);
  if (parts.length === 0) parts.push(blockingEscs[0]?.trigger ?? 'A blocking compliance issue requires human review.');

  const approver = blockingEscs.sort((a, b) => (b.hierarchy_level ?? 0) - (a.hierarchy_level ?? 0))[0]?.escalate_to ?? 'Procurement Manager';
  return {
    status: 'cannot_proceed',
    decision_summary: 'This request requires human intervention before sourcing can proceed.',
    justification: parts.join(' '),
    next_action: `${approver} to review and approve before any award is made.`,
    key_reasons: blockingEscs.map(e => e.trigger ?? e.rule).slice(0, 3),
    risks: [
      ...(policyConflict ? ['Policy conflict must be resolved'] : []),
      ...(tierEsc ? [`${tierEsc.escalate_to} sign-off required`] : []),
      ...(unapproved ? ['Supplier qualification required'] : []),
    ],
  };
}

export function generateDecision(structuredRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext, onChunk = null) {
  const hasBlocking = escalations.some(e => e.blocking === true);
  if (onChunk) onChunk("Generating decision justification...\n");
  const d = buildMockDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest);
  return {
    status: d.status ?? (hasBlocking ? 'cannot_proceed' : 'recommended'),
    reason: d.decision_summary,
    decision_summary: d.decision_summary,
    justification: d.justification,
    next_action: d.next_action,
    rationale: `${d.decision_summary}\n\n${d.justification}\n\nNext Action: ${d.next_action}`,
    preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
    key_reasons: d.key_reasons,
    risks: d.risks,
    minimum_budget_required: null,
    savings_vs_budget_pct: null,
  };
}
