const INFERENCE_LIMITS = {
  max_budget_auto_fill: { EUR: 100000, CHF: 110000, USD: 108000 },
  require_explicit_above: { EUR: 25000, CHF: 27500, USD: 27000 },
  max_quantity_variance_pct: 50
};

function getAzureChatCompletionsUrl() {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!endpoint) return null;

  if (endpoint.includes("/models/chat/completions")) {
    return endpoint;
  }

  const trimmedEndpoint = endpoint.replace(/\/$/, "");
  return `${trimmedEndpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-05-01-preview`;
}

function usesModelRoutedEndpoint() {
  return process.env.AZURE_OPENAI_ENDPOINT?.includes("/models/chat/completions");
}

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

function parseTextFallback(text) {
  const tl = text.toLowerCase();

  // Category
  let category_l1 = null, category_l2 = null;
  if (/dock|docking\s+station/i.test(text))                { category_l1 = 'IT';          category_l2 = 'Docking Stations'; }
  else if (/laptop|notebook|portable\s+computer/i.test(text)) { category_l1 = 'IT';       category_l2 = 'Laptops'; }
  else if (/monitor|screen|display/i.test(text))           { category_l1 = 'IT';          category_l2 = 'Monitors'; }
  else if (/smartphone|phone/i.test(text))                 { category_l1 = 'IT';          category_l2 = 'Smartphones'; }
  else if (/maya|autocad|autodesk|software\s+licen/i.test(text)) { category_l1 = 'IT';   category_l2 = 'Software Licenses'; }
  else if (/cooler|medical\s+transport/i.test(text))       { category_l1 = 'Facilities';  category_l2 = 'Medical Transport Coolers'; }
  else if (/\bcar\b|vehicle/i.test(text))                  { category_l1 = 'Facilities';  category_l2 = 'Vehicles'; }

  // Quantity — number followed by a product noun, or standalone for licenses/seats
  const qtyMatch = text.match(/\b(\d[\d,\s]*)\s*(?:units?|docking\s+stations?|laptops?|monitors?|screens?|licen[cs]es?|seats?|coolers?|vehicles?|cars?|smartphones?)/i)
    || text.match(/(?:add|renew|need)\s+(\d+)\s+(?:new\s+)?seats?/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1].replace(/[,\s]/g, '')) : null;

  // Budget — "25 199.55 EUR", "45k", "12k USD", "Total budget 45k"
  let budget_amount = null, currency = 'EUR';
  // Pattern 1: number(k/m) then currency — "12k USD", "25 199.55 EUR"
  const bmKCurr = text.match(/([0-9][\d\s,.]*)\s*k\s+(EUR|CHF|USD)/i);
  const bmNumCurr = text.match(/([0-9][\d\s,.]*(?:\.\d+)?)\s*(EUR|CHF|USD)/i);
  const bmCurrNum = text.match(/(EUR|CHF|USD)\s*([0-9][\d,\s]*(?:\.\d+)?)/i);
  // Pattern 2: "45k" with no currency (plain shorthand, default EUR)
  const bmKOnly = text.match(/(?:budget[^0-9]*|total[^0-9]*)([0-9]+(?:\.\d+)?)\s*k\b/i);

  if (bmKCurr) {
    budget_amount = parseFloat(bmKCurr[1].replace(/[\s,]/g, '')) * 1000;
    currency = bmKCurr[2].toUpperCase();
  } else if (bmNumCurr) {
    const raw = bmNumCurr[1].replace(/\s/g, '');
    budget_amount = parseFloat(raw.replace(',', '.'));
    currency = bmNumCurr[2].toUpperCase();
    if (isNaN(budget_amount)) budget_amount = null;
  } else if (bmCurrNum) {
    budget_amount = parseFloat(bmCurrNum[2].replace(/[\s,]/g, '').replace(',', '.'));
    currency = bmCurrNum[1].toUpperCase();
    if (isNaN(budget_amount)) budget_amount = null;
  } else if (bmKOnly) {
    budget_amount = parseFloat(bmKOnly[1]) * 1000;
  }

  // Country/location
  const countryMap = {
    germany: 'DE', berlin: 'DE', munich: 'DE', frankfurt: 'DE', hamburg: 'DE',
    switzerland: 'CH', geneva: 'CH', zurich: 'CH',
    france: 'FR', paris: 'FR',
    uk: 'GB', london: 'GB',
    kigali: 'RW', rwanda: 'RW',
    usa: 'US', 'united states': 'US',
    netherlands: 'NL', amsterdam: 'NL',
  };
  const delivery_countries = [];
  for (const [keyword, code] of Object.entries(countryMap)) {
    if (tl.includes(keyword) && !delivery_countries.includes(code)) delivery_countries.push(code);
  }

  // Date
  let required_by_date = null, days_until_required = null;
  const isoDate = text.match(/(\d{4}-\d{2}-\d{2})/);
  const humanDate = text.match(/(?:by|before|until|deadline)\s+([A-Z][a-z]+\s+\d{1,2},?\s*\d{4})/i);
  if (isoDate) {
    required_by_date = isoDate[1];
    days_until_required = Math.ceil((new Date(isoDate[1]).getTime() - Date.now()) / 86400000);
  } else if (humanDate) {
    const d = new Date(humanDate[1]);
    if (!isNaN(d)) {
      required_by_date = d.toISOString().split('T')[0];
      days_until_required = Math.ceil((d.getTime() - Date.now()) / 86400000);
    }
  } else if (/end\s+of\s+month/i.test(text)) {
    const now = new Date();
    const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    required_by_date = eom.toISOString().split('T')[0];
    days_until_required = Math.ceil((eom.getTime() - now.getTime()) / 86400000);
  }

  // Preferred supplier
  const supplierMatch = text.match(/(?:prefer(?:red)?|please\s+use|use)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/);
  const preferred_supplier_stated = supplierMatch ? supplierMatch[1].trim() : null;

  const gaps = [
    ...(!category_l2 ? ['category_l1', 'category_l2'] : []),
    ...(!quantity     ? ['quantity']     : []),
    ...(!budget_amount ? ['budget_amount'] : []),
  ];

  return {
    category_l1,
    category_l2,
    quantity,
    budget_amount,
    currency,
    delivery_countries: delivery_countries.length ? delivery_countries : ['DE'],
    required_by_date,
    days_until_required,
    preferred_supplier_stated,
    detected_language: 'en',
    gaps,
    demand_reframe_flag: false,
    unclear_intent: !category_l2 && !quantity,
  };
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
      demand_reframe_flag: false,
      unclear_intent: false
    }
  }

  // No metadata — parse the request text directly
  return parseTextFallback(text);
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
    const azureChatUrl = getAzureChatCompletionsUrl();
    if (!azureChatUrl) throw new Error("Missing Azure chat completions endpoint");

    const response = await fetch(
      azureChatUrl,
      {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_KEY
        },
        body: JSON.stringify({
          ...(usesModelRoutedEndpoint() ? { model: process.env.AZURE_OPENAI_DEPLOYMENT } : {}),
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
- unclear_intent: boolean, true if the request is too vague to determine what is being procured (e.g. "I need stuff" or "order things for the team")

Today's date: ${new Date().toISOString().split('T')[0]}

Request text: "${requestText}"

Return ONLY the JSON object, nothing else.` }
          ],
          max_completion_tokens: 600,
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
