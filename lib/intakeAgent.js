import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    request_language: {
      type: "string",
      description: "Detected language code, e.g. 'en', 'de', 'fr'",
    },
    category_l1: {
      type: "string",
      description: "Top-level procurement category, e.g. 'IT', 'Professional Services'",
    },
    category_l2: {
      type: "string",
      description: "Sub-category, e.g. 'Docking Stations', 'IT Project Management Services'",
    },
    title: {
      type: "string",
      description: "Short title summarising the request",
    },
    quantity: {
      type: "number",
      description: "Number of units requested, or null if not stated",
    },
    unit_of_measure: {
      type: "string",
      description: "Unit of measure, e.g. 'device', 'consulting_day', 'license'",
    },
    budget_amount: {
      type: "number",
      description: "Budget figure as a number, or null if not stated",
    },
    currency: {
      type: "string",
      description: "ISO 4217 currency code, e.g. 'EUR', 'USD'",
    },
    required_by_date: {
      type: "string",
      description: "ISO 8601 date the goods/services are needed by, or null",
    },
    delivery_countries: {
      type: "array",
      items: { type: "string" },
      description: "ISO 3166-1 alpha-2 country codes for delivery locations",
    },
    preferred_supplier_mentioned: {
      type: "string",
      description: "Name of any supplier the requester explicitly prefers, or null",
    },
    contract_type_requested: {
      type: "string",
      description: "'purchase', 'rental', 'service', or null if unclear",
    },
    data_residency_constraint: {
      type: "boolean",
      description: "True if the requester mentions data residency or sovereignty requirements",
    },
    esg_requirement: {
      type: "boolean",
      description: "True if the requester mentions ESG, sustainability, or ethical sourcing",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "List of important fields that could not be extracted from the text",
    },
    confidence_score: {
      type: "number",
      description: "0–100 score reflecting how complete and unambiguous the extraction is",
    },
    scenario_tags: {
      type: "array",
      items: { type: "string" },
      description: "Tags describing notable request characteristics, e.g. ['urgent', 'contradictory', 'high_value']",
    },
  },
  required: [
    "request_language",
    "category_l1",
    "category_l2",
    "title",
    "quantity",
    "unit_of_measure",
    "budget_amount",
    "currency",
    "required_by_date",
    "delivery_countries",
    "preferred_supplier_mentioned",
    "contract_type_requested",
    "data_residency_constraint",
    "esg_requirement",
    "gaps",
    "confidence_score",
    "scenario_tags",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are a procurement intake parser. Your job is to extract structured information from free-text procurement requests.

Rules:
- Extract only what is explicitly or strongly implied in the text. Do not invent values.
- For numeric fields (quantity, budget_amount) use null if not stated.
- For string fields (required_by_date, preferred_supplier_mentioned, etc.) use null if not stated.
- delivery_countries: infer from site/country mentions; use ISO alpha-2 codes (e.g. "DE", "ES").
- contract_type_requested: default to "purchase" unless "rent", "lease", "service", or similar is mentioned.
- gaps: list field names that are missing and would normally be expected (e.g. "quantity", "budget_amount", "required_by_date").
- confidence_score: reflect completeness (100 = all key fields present and clear, 0 = almost nothing extractable).
- scenario_tags: flag notable characteristics such as "urgent", "contradictory", "high_value", "single_source", "data_residency", "esg".`;

/**
 * Parse a free-text procurement request into structured JSON.
 *
 * @param {string} rawText - The raw text of the procurement request.
 * @param {object} [context] - Optional metadata already known (e.g. requester_id, business_unit).
 * @returns {Promise<object>} Structured request interpretation.
 */
export async function runIntakeAgent(rawText, context = {}) {
  const userContent = context && Object.keys(context).length > 0
    ? `Known context:\n${JSON.stringify(context, null, 2)}\n\nRequest text:\n${rawText}`
    : `Request text:\n${rawText}`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: {
        type: "json_schema",
        json_schema: {
          name: "procurement_intake",
          schema: OUTPUT_SCHEMA,
        },
      },
    },
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    throw new Error("No text block in response");
  }

  const parsed = JSON.parse(textBlock.text);

  return {
    ...context,
    ...parsed,
    processed_at: new Date().toISOString(),
    status: "pending_review",
  };
}
