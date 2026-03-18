import Anthropic from "@anthropic-ai/sdk";
import { OrderPayloadSchema, type IntakeResult } from "../types/order";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT =
  "You are a data extraction assistant. Parse the user's raw order text and return ONLY a valid JSON object matching the OrderPayload schema. No prose, no markdown, no explanation — raw JSON only.";

export async function parseOrder(rawText: string): Promise<IntakeResult> {
  let responseText: string;

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: rawText }],
    });

    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { success: false, reason: "Model returned no text content" };
    }
    responseText = block.text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, reason: `API call failed: ${msg}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return { success: false, reason: "Model response was not valid JSON" };
  }

  const result = OrderPayloadSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join("; ");
    return { success: false, reason: `Schema validation failed: ${issues}` };
  }

  return { success: true, payload: result.data };
}
