import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the two dependencies before importing the route
vi.mock("../../src/lib/validator", () => ({
  validateOrder: vi.fn(),
}));
vi.mock("../../src/lib/decisionEngine", () => ({
  decide: vi.fn(),
}));

import { POST } from "../../src/app/api/process/route";
import { validateOrder } from "../../src/lib/validator";
import { decide } from "../../src/lib/decisionEngine";

const mockValidateOrder = vi.mocked(validateOrder);
const mockDecide        = vi.mocked(decide);

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  items:    [{ name: "Widget", qty: 2, price: 10 }],
  budget:   100,
  currency: "USD",
};

beforeEach(() => vi.clearAllMocks());

// ── 200 ───────────────────────────────────────────────────────────────────

describe("200 — valid order, recommend", () => {
  it("returns 200 with recommendation when pipeline succeeds", async () => {
    mockValidateOrder.mockReturnValueOnce({ valid: true, data: VALID_PAYLOAD });
    mockDecide.mockResolvedValueOnce({
      outcome:        "recommend",
      recommendation: "Approved — within budget.",
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ recommendation: "Approved — within budget." });
  });
});

// ── 400 ───────────────────────────────────────────────────────────────────

describe("400 — invalid order", () => {
  it("returns 400 with errors array when validateOrder fails", async () => {
    mockValidateOrder.mockReturnValueOnce({
      valid:  false,
      errors: ["budget is required", "qty must be > 0"],
    });

    const res = await POST(makeRequest({ items: [] }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ errors: ["budget is required", "qty must be > 0"] });
    expect(mockDecide).not.toHaveBeenCalled();
  });
});

// ── 422 ───────────────────────────────────────────────────────────────────

describe("422 — cannot_proceed", () => {
  it("returns 422 with reason when decide returns cannot_proceed", async () => {
    mockValidateOrder.mockReturnValueOnce({ valid: true, data: VALID_PAYLOAD });
    mockDecide.mockResolvedValueOnce({
      outcome: "cannot_proceed",
      reason:  "Supplier unavailable for this region.",
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body).toEqual({ reason: "Supplier unavailable for this region." });
  });
});

// ── 500 ───────────────────────────────────────────────────────────────────

describe("500 — unhandled exception", () => {
  it("returns 500 when validateOrder throws", async () => {
    mockValidateOrder.mockImplementationOnce(() => {
      throw new Error("Unexpected DB failure");
    });

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
  });

  it("returns 500 when decide throws", async () => {
    mockValidateOrder.mockReturnValueOnce({ valid: true, data: VALID_PAYLOAD });
    mockDecide.mockRejectedValueOnce(new Error("Unexpected failure"));

    const res = await POST(makeRequest(VALID_PAYLOAD));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
  });
});
