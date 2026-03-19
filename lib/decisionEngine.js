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
      rationale: hasBlocking 
        ? 'Multiple blocking issues were detected including insufficient budget and infeasible lead time. Human intervention is required before sourcing can proceed.'
        : `Based on the analysis, ${rankedSuppliers[0]?.supplier_name || 'the top supplier'} is recommended with a composite score of ${rankedSuppliers[0]?.composite_score}. This supplier offers the best balance of price, lead time, quality and ESG compliance.`,
      preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
      key_reasons: rankedSuppliers[0] ? [
        `Best composite score: ${rankedSuppliers[0]?.composite_score}`,
        `Unit price: ${rankedSuppliers[0]?.unit_price} ${structuredRequest.currency}`,
        `Lead time: ${rankedSuppliers[0]?.standard_lead_time_days} days`
      ] : ['No compliant supplier found'],
      risks: hasBlocking ? ['Budget must be confirmed before proceeding', 'Delivery deadline may not be achievable'] : ['Monitor supplier capacity', 'Verify warranty terms before award'],
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
        rationale: hasBlocking 
          ? 'Multiple blocking issues were detected. Human intervention is required before sourcing can proceed.'
          : `Based on the analysis, ${rankedSuppliers[0]?.supplier_name || 'the top supplier'} is recommended with a composite score of ${rankedSuppliers[0]?.composite_score}.`,
        preferred_supplier_if_resolved: rankedSuppliers[0]?.supplier_name || null,
        key_reasons: rankedSuppliers[0] ? [
          `Best composite score: ${rankedSuppliers[0]?.composite_score}`,
          `Unit price: ${rankedSuppliers[0]?.unit_price} ${structuredRequest.currency}`,
          `Lead time: ${rankedSuppliers[0]?.standard_lead_time_days} days`
        ] : ['No compliant supplier found'],
        risks: hasBlocking ? ['Budget must be confirmed before proceeding'] : ['Monitor supplier capacity'],
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
