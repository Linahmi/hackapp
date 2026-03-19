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
      const hardLimit = INFERENCE_LIMITS.max_budget_auto_fill[currency] || 100000;
      const softLimit = INFERENCE_LIMITS.require_explicit_above[currency] || 25000;

      if (avgValue > hardLimit) {
        field_sources.budget_amount = 'missing:exceeds_threshold';
        assumptions.push(`Historical avg budget ${Math.round(avgValue)} ${currency} exceeds safe auto-fill limit of ${hardLimit} ${currency}. Explicit budget required.`);
      } else {
        req.budget_amount = Math.round(avgValue);
        const confidence = historicalContext.length >= 3 && avgValue <= softLimit
          ? 'inferred:history:high'
          : avgValue <= softLimit
            ? 'inferred:history:medium'
            : 'inferred:history:medium';
        field_sources.budget_amount = confidence;
        assumptions.push(`Inferred budget of ${req.budget_amount} ${currency} from ${historicalContext.length} historical award(s) — confidence: ${confidence.split(':').pop()}.`);
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
        const supplierConfidence = historicalContext.length >= 3 ? 'inferred:history:high' : 'inferred:history:medium';
        field_sources.preferred_supplier_stated = supplierConfidence;
        assumptions.push(`Inferred preferred supplier '${topSupplier}' from ${historicalContext.length} historical award(s) — confidence: ${supplierConfidence.split(':').pop()}.`);
      }
    } else {
      field_sources.preferred_supplier_stated = 'missing';
    }
  }

  // Handle missing quantity
  if (req.quantity == null) {
    if (historicalContext && historicalContext.length > 0) {
      field_sources.quantity = 'missing:low_confidence';
      assumptions.push(`Quantity not stated and historical context is insufficient to infer safely — explicit value required.`);
    } else {
      field_sources.quantity = 'missing';
    }
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
    let days_until_required = null;
    if (metadata.required_by_date) {
      const today = new Date();
      // Use date string directly to avoid timezone issues parsing
      const reqDate = new Date(metadata.required_by_date);
      const diffMs = reqDate.getTime() - today.getTime();
      days_until_required = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  
    return {
      category_l1: metadata.category_l1 || "IT",
      category_l2: metadata.category_l2,
      quantity: metadata.quantity || null,
      budget_amount: metadata.budget_amount || null,
      currency: metadata.currency || "EUR",
      delivery_countries: metadata.delivery_countries || 
                         (metadata.country ? [metadata.country] : ["DE"]),
      required_by_date: metadata.required_by_date || null,
      days_until_required: days_until_required !== null ? days_until_required : 45,
      preferred_supplier_stated: metadata.preferred_supplier_mentioned || null,
      detected_language: metadata.request_language || "en",
      gaps: [],
      demand_reframe_flag: false
    }
  }
  
  // Default fallback
  return {
    category_l1: null,
    category_l2: null,
    quantity: null,
    budget_amount: null,
    currency: "EUR",
    delivery_countries: [],
    required_by_date: null,
    days_until_required: null,
    preferred_supplier_stated: null,
    detected_language: "en",
    gaps: ["category_l1", "category_l2", "quantity", "budget_amount", "delivery_countries"],
    demand_reframe_flag: false
  }
}

export async function parseRequest(requestText, requestMetadata, onChunk = null) {
  const USE_MOCK = !process.env.AZURE_OPENAI_KEY;

  if (USE_MOCK) {
    if (onChunk) {
      await new Promise(r => setTimeout(r, 500));
      onChunk("Analyzing request...\n");
      await new Promise(r => setTimeout(r, 500));
      onChunk("Extracting constraints...\n");
    }
    return mockInterpretation(requestText, requestMetadata);
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
            { role: 'system', content: 'You are a procurement intake agent. Extract structured data from purchase requests. Return ONLY valid JSON.' },
            { role: 'user', content: `Parse this procurement request into JSON with these exact fields:
- category_l1: one of IT, Facilities, Professional Services, Marketing
- category_l2: specific subcategory like Laptops, Docking Stations, Consulting, etc.
- quantity: integer number of items/units (MUST be a number, not null, extract from text)
- budget_amount: total budget as a number (e.g. "25 199.55" → 25199.55, "490k" → 490000)
- currency: EUR, CHF, or USD
- delivery_countries: array of ISO 2-letter country codes (infer from city names: Geneva→CH, Munich→DE)
- required_by_date: ISO date string or null
- days_until_required: integer days from today or null
- preferred_supplier_stated: supplier name string or null
- detected_language: en, fr, de, es
- gaps: array of field names that could not be determined
- demand_reframe_flag: boolean, true if request seems unreasonable

Today's date: ${new Date().toISOString().split('T')[0]}

Request text: "${requestText}"

Return ONLY the JSON object, nothing else. Make sure "reasoning" is the VERY FIRST key in your JSON response so it streams out first.` }
          ],
          max_completion_tokens: 16000,
          response_format: { type: 'json_object' }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[intakeAgent] Azure error:', errorData);
      return mockInterpretation(requestText, requestMetadata);
    }

    if (!onChunk) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) return mockInterpretation(requestText, requestMetadata);
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    }

    // Handle Streaming Response
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let reasoningBuffer = "";
    let inReasoningString = false;

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

            // Very basic heuristic to stream out the "reasoning" field text specifically
            if (fullContent.includes('"reasoning": "') && !fullContent.includes('",\n')) {
               inReasoningString = true;
               // If it's the token right after the opening quote, or inside it
               if (token !== '"reasoning": "') {
                 // Remove trailing quotes if we just hit the end of the reasoning string
                 const cleanToken = token.replace(/\\"/g, '"').replace('",', '').replace('"', '');
                 onChunk(cleanToken);
               }
            } else if (inReasoningString && token.includes('",\n')) {
               inReasoningString = false; 
            }
          }
        } catch (e) {
          // Ignore incomplete JSON chunks from SSE
        }
      }
    }

    const clean = fullContent.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (error) {
    console.error('[intakeAgent] Error:', error.message);
    return mockInterpretation(requestText, requestMetadata);
  }
}
