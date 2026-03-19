/**
 * Build a rationale string from the actual computed pipeline state.
 * Only mentions conditions that are genuinely present.
 */
function buildRationale(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest) {
  if (!hasBlocking) {
    const top = rankedSuppliers[0];
    return `Based on the analysis, ${top?.supplier_name || 'the top supplier'} is recommended with a composite score of ${Math.round((top?.composite_score ?? 0) * 100)}. This supplier offers the best balance of price, lead time, quality and ESG compliance.`;
  }

  const issues = validationResult?.issues ?? [];
  const blockingEscs = escalations.filter(e => e.blocking);
  const parts = [];

  if (issues.some(i => ['missing_quantity', 'missing_budget'].includes(i.type))) {
    parts.push('Required information is missing — quantity and budget must both be provided before processing can continue.');
  }

  if (issues.some(i => i.type === 'budget_insufficient')) {
    const bi = issues.find(i => i.type === 'budget_insufficient');
    parts.push(bi.description ?? 'Budget is insufficient to cover the requested quantity.');
  }

  if (issues.some(i => i.type === 'lead_time_infeasible')) {
    const li = issues.find(i => i.type === 'lead_time_infeasible');
    parts.push(li.description ?? 'No supplier can meet the required delivery deadline.');
  }

  if (rankedSuppliers.length === 0 && !issues.some(i => i.type === 'budget_insufficient')) {
    parts.push('No eligible suppliers were found for this category and delivery region.');
  }

  const unapprovedEsc = blockingEscs.find(e => e.rule === 'ER-002' && e.trigger?.includes('not on the approved supplier list'));
  if (unapprovedEsc) {
    parts.push(`The preferred supplier '${structuredRequest.preferred_supplier_stated}' is not on the approved supplier list and requires manual procurement review before any award can proceed.`);
  } else if (blockingEscs.some(e => e.rule === 'ER-002' && e.trigger?.includes('restricted'))) {
    parts.push('The preferred supplier is restricted for this category and region — a compliant alternative must be selected.');
  }

  if (issues.some(i => i.type === 'policy_conflict')) {
    parts.push('A policy conflict was detected — the single-supplier instruction cannot override the competitive quoting requirement for this approval tier.');
  }

  const tierEsc = blockingEscs.find(e => e.rule === 'ER-003');
  if (tierEsc) {
    parts.push(`This contract value triggers a mandatory approval: ${tierEsc.escalate_to} sign-off is required before sourcing can proceed.`);
  }

  if (parts.length === 0) {
    parts.push(blockingEscs[0]?.trigger ?? 'A blocking compliance issue was detected that requires human intervention.');
  }

  return `Human intervention is required before sourcing can proceed. ${parts.join(' ')}`;
}

/**
 * Build a risks array from the actual computed pipeline state.
 */
function buildRisks(hasBlocking, validationResult, escalations) {
  if (!hasBlocking) return ['Monitor supplier capacity', 'Verify warranty terms before award'];
  const issues = validationResult?.issues ?? [];
  const risks = [];
  if (issues.some(i => i.type === 'budget_insufficient')) risks.push('Budget must be increased or quantity reduced before re-submission');
  if (issues.some(i => i.type === 'lead_time_infeasible')) risks.push('Delivery deadline must be renegotiated with the requester');
  if (issues.some(i => ['missing_quantity', 'missing_budget'].includes(i.type))) risks.push('Missing fields must be provided before processing can continue');
  if (escalations.some(e => e.rule === 'ER-002')) risks.push('Supplier selection requires Procurement Manager review');
  if (escalations.some(e => e.rule === 'ER-003')) risks.push('Approval sign-off must be obtained before award');
  return risks.length > 0 ? risks : ['Blocking issues must be resolved before sourcing can continue'];
}

export async function generateDecision(structuredRequest, validationResult, policyResult, rankedSuppliers, escalations, historicalContext, onChunk = null) {
  const USE_MOCK = !process.env.AZURE_OPENAI_KEY;
  const hasBlocking = escalations.some(e => e.blocking === true);

  if (USE_MOCK) {
    if (onChunk) {
      await new Promise(r => setTimeout(r, 500));
      onChunk("Evaluating policy constraints...\n");
      await new Promise(r => setTimeout(r, 500));
      onChunk("Comparing supplier scores...\n");
    }
    return {
      status: hasBlocking ? 'cannot_proceed' : 'recommended',
      reason: hasBlocking ? 'Blocking issues prevent autonomous decision' : 'Best supplier identified based on price, lead time and compliance',
      rationale: buildRationale(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest),
      preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
      key_reasons: rankedSuppliers[0] ? [
        `Best composite score: ${Math.round((rankedSuppliers[0]?.composite_score ?? 0) * 100)}`,
        `Unit price: ${rankedSuppliers[0]?.unit_price} ${structuredRequest.currency}`,
        `Lead time: ${rankedSuppliers[0]?.standard_lead_time_days} days`
      ] : ['No compliant supplier found'],
      risks: buildRisks(hasBlocking, validationResult, escalations),
      minimum_budget_required: null,
      savings_vs_budget_pct: null
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
            { role: 'user', content: `Make a procurement decision based on this data. Return JSON with these fields:
- rationale: 2-3 paragraphs referencing specific prices and policy rules. MAKE THIS THE VERY FIRST FIELD IN THE JSON.
- status: "recommended" or "cannot_proceed"
- reason: one-sentence summary
- preferred_supplier_if_resolved: supplier name string
- key_reasons: array of 3 short strings
- risks: array of risk strings
- minimum_budget_required: number or null
- savings_vs_budget_pct: number or null

Request: ${JSON.stringify(structuredRequest)}
Validation issues: ${JSON.stringify(validationResult.issues)}
Policy: ${JSON.stringify(policyResult)}
Ranked suppliers: ${JSON.stringify(rankedSuppliers)}
Escalations: ${JSON.stringify(escalations)}
Historical context: ${JSON.stringify(historicalContext)}` }
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
      return {
        status: hasBlocking ? 'cannot_proceed' : 'recommended',
        reason: hasBlocking ? 'Blocking issues prevent autonomous decision' : 'Best supplier identified based on price, lead time and compliance',
        rationale: buildRationale(hasBlocking, rankedSuppliers, validationResult, escalations, structuredRequest),
        preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
        key_reasons: rankedSuppliers[0] ? [
          `Best composite score: ${Math.round((rankedSuppliers[0]?.composite_score ?? 0) * 100)}`,
          `Unit price: ${rankedSuppliers[0]?.unit_price} ${structuredRequest.currency}`,
          `Lead time: ${rankedSuppliers[0]?.standard_lead_time_days} days`
        ] : ['No compliant supplier found'],
        risks: buildRisks(hasBlocking, validationResult, escalations),
        minimum_budget_required: null,
        savings_vs_budget_pct: null
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
    return {
      status: hasBlocking ? 'cannot_proceed' : 'recommended',
      reason: 'Fallback decision due to AI error',
      rationale: `AI processing failed. Based on scoring, ${rankedSuppliers[0]?.supplier_name || 'no supplier'} ranked highest.`,
      preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
      key_reasons: ['Fallback decision'],
      risks: ['AI decision engine unavailable'],
      minimum_budget_required: null,
      savings_vs_budget_pct: null
    };
  }
}
