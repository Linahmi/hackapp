const INFERENCE_LIMITS = {
  max_budget_auto_fill: { EUR: 100000, CHF: 110000, USD: 108000 },
  require_explicit_above: { EUR: 25000, CHF: 27500, USD: 27000 },
  max_quantity_variance_pct: 50
};

export function fillGapsFromHistory(structuredRequest, historicalContext, currency = 'EUR') {
  const req = { ...structuredRequest };
  const assumptions = [];
  const field_sources = {};

  // Mark stated fields
  for (const [key, value] of Object.entries(req)) {
    if (value !== null && value !== undefined && key !== 'gaps' && key !== 'demand_reframe_flag' && key !== 'original_gaps' && key !== 'remaining_gaps' && key !== 'assumptions' && key !== 'field_sources') {
      if (Array.isArray(value) && value.length === 0) continue;
      field_sources[key] = 'stated';
    }
  }

  // Handle missing budget
  if (req.budget_amount == null) {
    if (historicalContext && historicalContext.length > 0) {
      const avgValue = historicalContext.reduce((acc, a) => acc + (a.total_value || 0), 0) / historicalContext.length;
      const limit = INFERENCE_LIMITS.max_budget_auto_fill[currency] || 100000;
      
      if (avgValue > limit) {
        field_sources.budget_amount = 'missing';
        assumptions.push(`Historical avg budget ${Math.round(avgValue)} exceeds safe auto-fill limit of ${limit}. Explicit budget required.`);
      } else {
        req.budget_amount = Math.round(avgValue);
        field_sources.budget_amount = 'inferred';
        assumptions.push(`Inferred budget of ${req.budget_amount} ${currency} from ${historicalContext.length} historical awards.`);
      }
    } else {
      field_sources.budget_amount = 'missing';
    }
  }

  // Handle missing preferred supplier
  if (!req.preferred_supplier_stated) {
    if (historicalContext && historicalContext.length > 0) {
      const topSupplier = historicalContext[0].supplier_name;
      if (topSupplier) {
        req.preferred_supplier_stated = topSupplier;
        field_sources.preferred_supplier_stated = 'inferred';
        assumptions.push(`Inferred preferred supplier '${topSupplier}' based on historical awards.`);
      }
    } else {
      field_sources.preferred_supplier_stated = 'missing';
    }
  }

  // Handle missing quantity
  if (req.quantity == null) {
      field_sources.quantity = 'missing';
  }

  req.original_gaps = [...(req.gaps || [])];
  req.remaining_gaps = ['budget_amount', 'quantity', 'preferred_supplier_stated'].filter(k => field_sources[k] === 'missing');
  req.gaps = req.remaining_gaps;
  req.assumptions = assumptions;
  req.field_sources = field_sources;

  return req;
}

function mockInterpretation(text, metadata) {
  // If metadata has real request data, use it directly
  if (metadata && metadata.category_l2) {
    return {
      category_l1: metadata.category_l1 || "IT",
      category_l2: metadata.category_l2,
      quantity: metadata.quantity || null,
      budget_amount: metadata.budget_amount || null,
      currency: metadata.currency || "EUR",
      delivery_countries: metadata.delivery_countries || 
                         (metadata.country ? [metadata.country] : ["DE"]),
      required_by_date: metadata.required_by_date || null,
      days_until_required: 45,
      preferred_supplier_stated: metadata.preferred_supplier_mentioned || null,
      detected_language: metadata.request_language || "en",
      gaps: [],
      demand_reframe_flag: false
    }
  }
  
  // Default fallback: REQ-000004 edge case
  return {
    category_l1: "IT",
    category_l2: "Docking Stations",
    quantity: 240,
    budget_amount: 25199.55,
    currency: "EUR",
    delivery_countries: ["DE"],
    required_by_date: "2026-03-20",
    days_until_required: 6,
    preferred_supplier_stated: "Dell Enterprise Europe",
    detected_language: "en",
    gaps: [],
    demand_reframe_flag: false
  }
}

export async function parseRequest(requestText, requestMetadata) {
  const USE_MOCK = !process.env.AZURE_OPENAI_KEY;

  if (USE_MOCK) {
    return mockInterpretation(requestText, requestMetadata);
  }

  try {
    const response = await fetch(
      `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-01`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_KEY
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a procurement intake agent for ChainIQ. Extract structured requirements from purchase requests. Always respond in English regardless of input language. Return ONLY valid JSON, no markdown, no explanation.' },
            { role: 'user', content: `Extract structured fields from this purchase request. Return ONLY this JSON:\n{\n  "category_l1": string (IT/Facilities/Professional Services/Marketing),\n  "category_l2": string (specific subcategory),\n  "quantity": number or null,\n  "budget_amount": number or null,\n  "currency": string (EUR/CHF/USD),\n  "delivery_countries": array of 2-letter country codes,\n  "required_by_date": ISO date string or null,\n  "days_until_required": number or null,\n  "preferred_supplier_stated": string or null,\n  "detected_language": string (en/fr/de/es/pt/ja),\n  "gaps": array of missing field names,\n  "demand_reframe_flag": boolean\n}\nToday: ${new Date().toISOString().split('T')[0]}\nMetadata: ${JSON.stringify(requestMetadata)}\nRequest: ${requestText}` }
          ],
          max_tokens: 1000,
          temperature: 0
        })
      }
    );
    const data = await response.json();
    const text = data.choices[0].message.content;
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (error) {
    return { error: true, raw: error.message };
  }
}
