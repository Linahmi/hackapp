import { describe, it, expect, vi, beforeEach } from "vitest";
import { anthropic, parseOrder } from "../src/lib/intakeAgent";
import type { OrderPayload } from "../src/types/order";

// Helper: make anthropic.messages.create resolve with a text block
function mockResponse(text: string) {
  vi.spyOn(anthropic.messages, "create").mockResolvedValueOnce({
    id:           "msg_test",
    type:         "message",
    role:         "assistant",
    model:        "claude-sonnet-4-20250514",
    stop_reason:  "end_turn",
    stop_sequence: null,
    usage:        { input_tokens: 10, output_tokens: 10 },
    content:      [{ type: "text", text }],
  } as any);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------
describe("happy path", () => {
  it("parses a complete order payload correctly", async () => {
    const payload: OrderPayload = {
      items: [
        { name: "Widget A", qty: 3, price: 9.99 },
        { name: "Widget B", qty: 1, price: 49.0 },
      ],
      budget:   200,
      currency: "USD",
      notes:    "Deliver before Friday",
    };

    mockResponse(JSON.stringify(payload));

    const result = await parseOrder("3x Widget A at $9.99, 1x Widget B at $49, budget $200 USD");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payload.budget).toBe(200);
    expect(result.payload.currency).toBe("USD");
    expect(result.payload.notes).toBe("Deliver before Friday");
    expect(result.payload.items).toHaveLength(2);
    expect(result.payload.items[0]).toEqual({ name: "Widget A", qty: 3, price: 9.99 });
  });

  it("accepts a payload without the optional notes field", async () => {
    const payload: Omit<OrderPayload, "notes"> = {
      items:    [{ name: "Bolt", qty: 100, price: 0.05 }],
      budget:   50,
      currency: "EUR",
    };

    mockResponse(JSON.stringify(payload));

    const result = await parseOrder("100 bolts at €0.05 each, budget €50");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.payload.notes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Missing required field
// ---------------------------------------------------------------------------
describe("missing required field", () => {
  it("returns success:false when budget is absent", async () => {
    // budget is required by the schema — omit it
    const incomplete = {
      items:    [{ name: "Pen", qty: 5, price: 1.5 }],
      currency: "USD",
    };

    mockResponse(JSON.stringify(incomplete));

    const result = await parseOrder("5 pens at $1.50 each, USD");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toMatch(/validation failed/i);
  });

  it("returns success:false when items array is missing", async () => {
    const incomplete = { budget: 100, currency: "GBP" };

    mockResponse(JSON.stringify(incomplete));

    const result = await parseOrder("budget £100");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toMatch(/validation failed/i);
  });
});

// ---------------------------------------------------------------------------
// Unparseable input
// ---------------------------------------------------------------------------
describe("unparseable input", () => {
  it("returns success:false when the model responds with non-JSON", async () => {
    mockResponse("asdfgh");

    const result = await parseOrder("asdfgh");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toMatch(/not valid JSON/i);
  });

  it("returns success:false when the model wraps JSON in markdown", async () => {
    const payload: OrderPayload = {
      items:    [{ name: "X", qty: 1, price: 1 }],
      budget:   1,
      currency: "USD",
    };
    // Markdown code fence — JSON.parse will throw on this
    mockResponse("```json\n" + JSON.stringify(payload) + "\n```");

    const result = await parseOrder("something");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toMatch(/not valid JSON/i);
  });
});

// ---------------------------------------------------------------------------
// API failure
// ---------------------------------------------------------------------------
describe("API failure", () => {
  it("returns success:false when the API call throws", async () => {
    vi.spyOn(anthropic.messages, "create").mockRejectedValueOnce(
      new Error("Connection timeout")
    );

    const result = await parseOrder("anything");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toMatch(/API call failed/i);
    expect(result.reason).toMatch(/Connection timeout/i);
  });

  it("returns success:false when the API returns a non-text content block", async () => {
    vi.spyOn(anthropic.messages, "create").mockResolvedValueOnce({
      id:           "msg_empty",
      type:         "message",
      role:         "assistant",
      model:        "claude-sonnet-4-20250514",
      stop_reason:  "end_turn",
      stop_sequence: null,
      usage:        { input_tokens: 5, output_tokens: 0 },
      content:      [],           // no blocks at all
    } as any);

    const result = await parseOrder("anything");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.reason).toMatch(/no text content/i);
  });
});
