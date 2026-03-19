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
      decision_summary: `${top.supplier_name} is recommended as the best-value compliant option.`,
      justification: `Ranked first with a composite score of ${Math.round((top.composite_score ?? 0) * 100)}/100, offering the strongest balance of price (${top.unit_price} ${structuredRequest.currency}/unit), lead time (${top.standard_lead_time_days} days), and compliance. Budget is sufficient and delivery is feasible within the required window.`,
      next_action: 'Client to validate the order — no further approvals required.',
      key_reasons: [
        `Best composite score: ${Math.round((top.composite_score ?? 0) * 100)}`,
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

export async function generateDecision(structuredRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext, onChunk = null) {
  const hasBlocking = escalations.some(e => e.blocking === true);
  const USE_MOCK = !process.env.AZURE_OPENAI_KEY;

  if (USE_MOCK) {
    if (onChunk) onChunk("Generating decision justification...\n");
    const d = buildMockDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest);
    return {
      status: hasBlocking ? 'cannot_proceed' : 'recommended',
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

  try {
    const response = await fetch(
      `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-05-01-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_KEY
        },
        body: JSON.stringify({
          stream: !!onChunk,
          messages: [
            { role: 'system', content: 'You are a procurement decision engine. Analyze supplier data and make sourcing recommendations. Return ONLY valid JSON.' },
            { role: 'user', content: `Make a procurement decision based on this data. Return JSON with these fields:\n- rationale: 2-3 paragraphs referencing specific prices and policy rules. MAKE THIS THE VERY FIRST FIELD IN THE JSON.\n- status: "recommended" or "cannot_proceed"\n- reason: one-sentence summary\n- decision_summary: one-sentence summary\n- justification: detailed explanation\n- next_action: what happens next\n- preferred_supplier_if_resolved: supplier name string\n- key_reasons: array of 3 short strings\n- risks: array of risk strings\n- minimum_budget_required: number or null\n- savings_vs_budget_pct: number or null\n\nRequest: ${JSON.stringify(structuredRequest)}\nValidation issues: ${JSON.stringify(validationResult.issues)}\nPolicy: ${JSON.stringify(policyResult)}\nRanked suppliers: ${JSON.stringify(rankedSuppliers)}\nEscalations: ${JSON.stringify(escalations)}\nHistorical context: ${JSON.stringify(historicalContext)}` }
          ],
          max_completion_tokens: 16000,
          response_format: { type: 'json_object' }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[decisionEngine] Azure OpenAI error:', errorData);
      // Fall back to mock decision
      const d = buildMockDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest);
      return {
        status: hasBlocking ? 'cannot_proceed' : 'recommended',
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

    if (!onChunk) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);
      if (hasBlocking) result.status = 'cannot_proceed';
      return result;
    }

    // Handle Streaming Response
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let inRationaleString = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.replace("data: ", "").trim();
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const token = parsed.choices[0]?.delta?.content || "";
          if (token) {
            fullContent += token;

            // Stream out the "rationale" field text specifically
            if (fullContent.includes('"rationale": "') && !fullContent.includes('",\n')) {
               inRationaleString = true;
               if (token !== '"rationale": "') {
                 const cleanToken = token.replace(/\\"/g, '"').replace('",', '').replace('"', '').replace(/\\n/g, '\n');
                 onChunk(cleanToken);
               }
            } else if (inRationaleString && token.includes('",\n')) {
               inRationaleString = false;
            }
          }
        } catch (e) {}
      }
    }

    const clean = fullContent.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    if (hasBlocking) {
      result.status = 'cannot_proceed';
    }
    return result;
  } catch (error) {
    console.error('[decisionEngine] Error:', error.message);
    const d = buildMockDecision(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest);
    return {
      status: hasBlocking ? 'cannot_proceed' : 'recommended',
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
}
