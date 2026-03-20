/**
 * Build structured decision output from the actual computed pipeline state.
 * generateDecision() calls Azure OpenAI to produce a real, data-driven justification.
 * Falls back to template strings if the key is absent.
 */

// ─── Azure helper ─────────────────────────────────────────────────────────────

function getAzureUrl() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!endpoint) return null;
  if (endpoint.includes('/models/chat/completions')) return endpoint;
  const base = endpoint.replace(/\/$/, '');
  return `${base}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-05-01-preview`;
}

function usesModelRoute() {
  return process.env.AZURE_OPENAI_ENDPOINT?.includes('/models/chat/completions');
}

async function callAzure(systemPrompt, userPrompt) {
  const url = getAzureUrl();
  if (!url || !process.env.AZURE_OPENAI_KEY) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_KEY,
      },
      body: JSON.stringify({
        ...(usesModelRoute() ? { model: process.env.AZURE_OPENAI_DEPLOYMENT } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildJustificationPrompt(d, structuredRequest, rankedSuppliers, escalations, validationResult) {
  const top     = rankedSuppliers[0];
  const runner  = rankedSuppliers[1];
  const issues  = validationResult?.issues ?? [];
  const blocking = escalations.filter(e => e.blocking);

  const req = [
    `Category: ${structuredRequest.category_l2 ?? structuredRequest.category_l1 ?? 'Unknown'}`,
    `Quantity: ${structuredRequest.quantity ?? 'not stated'}`,
    `Budget: ${structuredRequest.budget_amount ? `${structuredRequest.budget_amount} ${structuredRequest.currency}` : 'not stated'}`,
    `Delivery countries: ${(structuredRequest.delivery_countries ?? []).join(', ') || 'not specified'}`,
    structuredRequest.days_until_required != null
      ? `Days until required: ${structuredRequest.days_until_required}`
      : null,
  ].filter(Boolean).join(' | ');

  const supplierLines = rankedSuppliers.slice(0, 3).map((s, i) =>
    `  ${i + 1}. ${s.supplier_name} — score ${Math.round((s.composite_score ?? 0) * 100)}/100, price ${s.unit_price ?? s.total_price ?? '?'} ${structuredRequest.currency}/unit, lead time ${s.standard_lead_time_days ?? '?'} days, risk score ${s.risk_score ?? '?'}`
  ).join('\n');

  const escalationLines = blocking.map(e =>
    `  - ${e.rule}: ${e.trigger}${e.escalate_to ? ` (requires ${e.escalate_to})` : ''}`
  ).join('\n');

  const issueLines = issues.map(i => `  - ${i.type}: ${i.description ?? ''}`).join('\n');

  const systemPrompt = `You are a senior procurement analyst writing formal decision justifications for an AI-assisted sourcing platform.
Write in concise, professional English. Be specific — cite actual numbers from the data.
Never use generic filler. 2–4 sentences maximum.`;

  let userPrompt;

  if (d.status === 'recommended' && top) {
    userPrompt = `Write a justification for why ${top.supplier_name} was selected as the recommended supplier.

Request context: ${req}
Shortlisted suppliers (ranked):
${supplierLines}

Focus on: composite score advantage over runner-up${runner ? ` (${runner.supplier_name} scored ${Math.round((runner.composite_score ?? 0) * 100)}/100)` : ''}, price competitiveness, lead time feasibility relative to the deadline, and policy compliance. Be specific about the numbers.`;

  } else if (issues.find(i => i.type === 'lead_time_infeasible' || i.type === 'deadline_passed')) {
    const issue = issues.find(i => i.type === 'lead_time_infeasible' || i.type === 'deadline_passed');
    userPrompt = `Write a justification for why this procurement request cannot proceed due to an infeasible delivery timeline.

Request context: ${req}
Issue: ${issue?.description ?? 'Delivery deadline cannot be met'}
${top ? `Fastest available supplier: ${top.supplier_name} with ${top.standard_lead_time_days} days lead time` : ''}

Explain specifically why the timeline is unachievable given the available supplier lead times and state what must change.`;

  } else if (issues.find(i => i.type === 'budget_insufficient')) {
    const issue = issues.find(i => i.type === 'budget_insufficient');
    userPrompt = `Write a justification for why this procurement request cannot proceed due to insufficient budget.

Request context: ${req}
Issue: ${issue?.description ?? 'Budget is below the minimum required'}
${top ? `Lowest available offer: ${top.supplier_name} at ${top.unit_price ?? top.total_price ?? '?'} ${structuredRequest.currency}/unit` : ''}

Explain the gap between stated budget and minimum viable offer. Be specific about figures.`;

  } else if (blocking.length > 0) {
    userPrompt = `Write a justification for why this procurement request requires human intervention before it can proceed.

Request context: ${req}
Blocking compliance issues:
${escalationLines}
${issueLines ? `Validation issues:\n${issueLines}` : ''}
${top ? `Best available supplier if resolved: ${top.supplier_name} (score ${Math.round((top.composite_score ?? 0) * 100)}/100)` : ''}

Explain what policy rules were triggered and why they prevent automatic approval.`;

  } else {
    userPrompt = `Write a justification for this procurement decision.

Request context: ${req}
Decision: ${d.decision_summary}
${supplierLines ? `Suppliers evaluated:\n${supplierLines}` : ''}

Be specific and professional.`;
  }

  return { systemPrompt, userPrompt };
}

// ─── Template fallback ────────────────────────────────────────────────────────

function buildTemplateDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest) {
  const issues = validationResult?.issues ?? [];
  const blockingEscs = escalations.filter(e => e.blocking);
  const top = rankedSuppliers[0];

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

  const infeasible   = issues.find(i => i.type === 'lead_time_infeasible');
  const deadlinePast = issues.find(i => i.type === 'deadline_passed');
  if (infeasible || deadlinePast) {
    const detail = infeasible?.description ?? deadlinePast?.description ?? 'The requested delivery date cannot be met.';
    return {
      status: 'cannot_proceed',
      decision_summary: 'This request cannot proceed — the delivery deadline is not achievable.',
      justification: `${detail} No supplier in the approved panel can fulfill this requirement within the requested window, even on an expedited basis.`,
      next_action: 'Procurement should contact the requester to confirm a revised delivery date.',
      key_reasons: ['Delivery deadline infeasible', 'No expedited option available'],
      risks: ['Deadline must be renegotiated before resubmission'],
    };
  }

  const missingFields = issues.filter(i => ['missing_quantity', 'missing_budget', 'missing_field'].includes(i.type));
  if (missingFields.length > 0 || (!structuredRequest.category_l1 && !structuredRequest.category_l2)) {
    const fields = missingFields.map(i => i.type.replace('missing_', '')).join(', ') || 'category, quantity';
    return {
      status: 'cannot_proceed',
      decision_summary: 'This request cannot be processed — critical information is missing.',
      justification: `The request is missing required procurement fields: ${fields}. Without this data, supplier matching and compliance checks cannot be completed.`,
      next_action: 'Procurement should contact the requester and collect the missing information before resubmission.',
      key_reasons: [`Missing: ${fields}`],
      risks: ['Request on hold until missing fields are provided'],
    };
  }

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

  if (rankedSuppliers.length === 0) {
    return {
      status: 'cannot_proceed',
      decision_summary: 'No compliant supplier is available for this requirement.',
      justification: `No supplier in the approved panel covers this category and delivery region with the specified constraints.`,
      next_action: 'Sourcing Specialist to identify and qualify a new supplier or escalate to category management.',
      key_reasons: ['No approved panel supplier matched', 'Scope outside existing framework'],
      risks: ['New supplier onboarding required', 'Timeline impact likely'],
    };
  }

  const unapproved    = blockingEscs.find(e => e.rule === 'ER-002');
  const tierEsc       = blockingEscs.find(e => e.rule === 'ER-003');
  const policyConflict = issues.find(i => i.type === 'policy_conflict');

  const parts = [];
  if (unapproved)     parts.push(`The preferred supplier is not on the approved panel and cannot be awarded without prior qualification.`);
  if (policyConflict) parts.push(`A single-supplier instruction was detected but policy requires competitive quoting at this approval tier.`);
  if (tierEsc)        parts.push(`Contract value triggers a mandatory ${tierEsc.escalate_to} sign-off before sourcing can proceed.`);
  if (!parts.length)  parts.push(blockingEscs[0]?.trigger ?? 'A blocking compliance issue requires human review.');

  const approver = [...blockingEscs].sort((a, b) => (b.hierarchy_level ?? 0) - (a.hierarchy_level ?? 0))[0]?.escalate_to ?? 'Procurement Manager';
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateDecision(structuredRequest, validationResult, _policyResult, rankedSuppliers, escalations, _historicalContext, onChunk = null) {
  const hasBlocking = escalations.some(e => e.blocking === true);
  if (onChunk) onChunk("Generating decision justification...\n");

  const d = buildTemplateDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest);

  // Try to generate a real AI justification
  let aiJustification = null;
  if (process.env.AZURE_OPENAI_KEY) {
    const { systemPrompt, userPrompt } = buildJustificationPrompt(d, structuredRequest, rankedSuppliers, escalations, validationResult);
    aiJustification = await callAzure(systemPrompt, userPrompt);
    if (onChunk && aiJustification) onChunk("Justification generated.\n");
  }

  const justification = aiJustification ?? d.justification;

  return {
    status:                        d.status ?? (hasBlocking ? 'cannot_proceed' : 'recommended'),
    reason:                        d.decision_summary,
    decision_summary:              d.decision_summary,
    justification,
    next_action:                   d.next_action,
    rationale:                     `${d.decision_summary}\n\n${justification}\n\nNext Action: ${d.next_action}`,
    preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
    key_reasons:                   d.key_reasons,
    risks:                         d.risks,
    minimum_budget_required:       null,
    savings_vs_budget_pct:         null,
  };
}
