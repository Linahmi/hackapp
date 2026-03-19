function mockInterpretation(text, metadata) {
  // If metadata has real request data, use it directly
  if (metadata && metadata.category_l2 && metadata.budget_amount) {
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
