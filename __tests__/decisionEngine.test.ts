import { describe, it, expect, vi, beforeEach } from "vitest";
import { anthropic, decide } from "../src/lib/decisionEngine";
import type { OrderPayload } from "../src/types/order";

const SAMPLE_PAYLOAD: OrderPayload = {
  items:    [{ name: "Widget", qty: 2, price: 10 }],
  budget:   100,
  currency: "USD",
};

function mockResponse(text: string) {
  vi.spyOn(anthropic.messages, "create").mockResolvedValueOnce({
    id:            "msg_test",
    type:          "message",
    role:          "assistant",
    model:         "claude-sonnet-4-20250514",
    stop_reason:   "end_turn",
    stop_sequence: null,
    usage:         { input_tokens: 10, output_tokens: 10 },
    content:       [{ type: "text", text }],
  } as any);
}

beforeEach(() => vi.restoreAllMocks());

// ── Happy path: recommend ──────────────────────────────────────────────────

describe("happy path — recommend", () => {
  it("returns outcome:recommend with the model's recommendation string", async () => {
    mockResponse(JSON.stringify({
      outcome:        "recommend",
      recommendation: "Order looks good — within budget and well-specified.",
    }));

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("recommend");
    if (result.outcome !== "recommend") return;
    expect(result.recommendation).toBe(
      "Order looks good — within budget and well-specified."
    );
  });
});

// ── Happy path: cannot_proceed ─────────────────────────────────────────────

describe("happy path — cannot_proceed", () => {
  it("returns outcome:cannot_proceed with the model's reason verbatim", async () => {
    mockResponse(JSON.stringify({
      outcome: "cannot_proceed",
      reason:  "Budget is insufficient for the requested quantity.",
    }));

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("cannot_proceed");
    if (result.outcome !== "cannot_proceed") return;
    expect(result.reason).toBe("Budget is insufficient for the requested quantity.");
  });
});

// ── Unparseable response ───────────────────────────────────────────────────

describe("unparseable response", () => {
  it("returns cannot_proceed + unavailable reason when model returns plain text", async () => {
    mockResponse("Sorry, I cannot help with that.");

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("cannot_proceed");
    if (result.outcome !== "cannot_proceed") return;
    expect(result.reason).toBe("Decision engine unavailable");
  });

  it("returns cannot_proceed + unavailable reason when model wraps JSON in markdown", async () => {
    mockResponse("```json\n{\"outcome\":\"recommend\",\"recommendation\":\"ok\"}\n```");

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("cannot_proceed");
    if (result.outcome !== "cannot_proceed") return;
    expect(result.reason).toBe("Decision engine unavailable");
  });

  it("returns cannot_proceed + unavailable reason when outcome field is missing", async () => {
    mockResponse(JSON.stringify({ recommendation: "Looks fine." }));

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("cannot_proceed");
    if (result.outcome !== "cannot_proceed") return;
    expect(result.reason).toBe("Decision engine unavailable");
  });
});

// ── API failure ────────────────────────────────────────────────────────────

describe("API failure", () => {
  it("returns cannot_proceed + unavailable reason when the API throws", async () => {
    vi.spyOn(anthropic.messages, "create").mockRejectedValueOnce(
      new Error("Network error")
    );

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("cannot_proceed");
    if (result.outcome !== "cannot_proceed") return;
    expect(result.reason).toBe("Decision engine unavailable");
  });

  it("returns cannot_proceed + unavailable reason when content block is empty", async () => {
    vi.spyOn(anthropic.messages, "create").mockResolvedValueOnce({
      id:            "msg_empty",
      type:          "message",
      role:          "assistant",
      model:         "claude-sonnet-4-20250514",
      stop_reason:   "end_turn",
      stop_sequence: null,
      usage:         { input_tokens: 5, output_tokens: 0 },
      content:       [],
    } as any);

    const result = await decide(SAMPLE_PAYLOAD);

    expect(result.outcome).toBe("cannot_proceed");
    if (result.outcome !== "cannot_proceed") return;
    expect(result.reason).toBe("Decision engine unavailable");
  });
});
