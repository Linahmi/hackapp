import Anthropic from "@anthropic-ai/sdk";
import type { OrderPayload } from "../types/order";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT =
  "You are a procurement advisor. Given an order, either recommend it with a short justification, or explain why it cannot proceed. Reply ONLY with a JSON object: { outcome, recommendation?, reason? }. No prose, no markdown, raw JSON only.";

export type Decision =
  | { outcome: "recommend";      recommendation: string }
  | { outcome: "cannot_proceed"; reason: string };

const UNAVAILABLE: Decision = {
  outcome: "cannot_proceed",
  reason:  "Decision engine unavailable",
};

export async function decide(payload: OrderPayload): Promise<Decision> {
  let responseText: string;

  try {
    const message = await anthropic.messages.create({
      model:    "claude-sonnet-4-20250514",
      max_tokens: 512,
      system:   SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });

    const block = message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return UNAVAILABLE;
    responseText = block.text;
  } catch {
    return UNAVAILABLE;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return UNAVAILABLE;
  }

  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "outcome" in parsed
  ) {
    const p = parsed as Record<string, unknown>;

    if (p.outcome === "recommend" && typeof p.recommendation === "string") {
      return { outcome: "recommend", recommendation: p.recommendation };
    }

    if (p.outcome === "cannot_proceed" && typeof p.reason === "string") {
      return { outcome: "cannot_proceed", reason: p.reason };
    }
  }

  return UNAVAILABLE;
}
