import { describe, it, expect } from "vitest";
import { validateOrder } from "../src/lib/validator";
import type { OrderPayload } from "../src/types/order";

function makeOrder(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    items:    [{ name: "Widget", qty: 2, price: 10 }],
    budget:   100,
    currency: "USD",
    ...overrides,
  };
}

// ── Rule 1: null / missing fields ──────────────────────────────────────────

describe("Rule 1 — null / missing fields", () => {
  it("pass: all required fields present → valid: true", () => {
    const result = validateOrder(makeOrder());
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.budget).toBe(100);
    expect(result.data.currency).toBe("USD");
  });

  it("fail: budget is null → valid: false", () => {
    const result = validateOrder({ ...makeOrder(), budget: null });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /budget/i.test(e))).toBe(true);
  });

  it("fail: items is missing → valid: false", () => {
    const { items: _items, ...noItems } = makeOrder();
    const result = validateOrder(noItems);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /items/i.test(e))).toBe(true);
  });

  it("fail: item.price is missing → valid: false", () => {
    const order = {
      ...makeOrder(),
      items: [{ name: "Widget", qty: 2 }],   // no price
    };
    const result = validateOrder(order);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /price/i.test(e))).toBe(true);
  });
});

// ── Rule 2: quantity constraints ───────────────────────────────────────────

describe("Rule 2 — quantity constraints", () => {
  it("pass: all qty are positive integers → valid: true", () => {
    const result = validateOrder(makeOrder({ items: [{ name: "A", qty: 5, price: 3 }] }));
    expect(result.valid).toBe(true);
  });

  it("fail: qty = 0 → valid: false", () => {
    const result = validateOrder(makeOrder({ items: [{ name: "A", qty: 0, price: 10 }] }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /qty/i.test(e))).toBe(true);
  });

  it("fail: qty is negative → valid: false", () => {
    const result = validateOrder(makeOrder({ items: [{ name: "A", qty: -3, price: 10 }] }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /qty/i.test(e))).toBe(true);
  });

  it("fail: qty is a non-integer float → valid: false", () => {
    const result = validateOrder(makeOrder({ items: [{ name: "A", qty: 1.5, price: 10 }] }));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /integer/i.test(e))).toBe(true);
  });
});

// ── Rule 3: total cost vs budget ───────────────────────────────────────────

describe("Rule 3 — total cost vs budget", () => {
  it("pass: total cost is under budget → valid: true", () => {
    const result = validateOrder(
      makeOrder({ items: [{ name: "A", qty: 2, price: 10 }], budget: 50 })
    );
    expect(result.valid).toBe(true);
  });

  it("pass: total cost equals budget exactly → valid: true", () => {
    const result = validateOrder(
      makeOrder({ items: [{ name: "A", qty: 2, price: 25 }], budget: 50 })
    );
    expect(result.valid).toBe(true);
  });

  it("fail: total cost exceeds budget → valid: false", () => {
    const result = validateOrder(
      makeOrder({ items: [{ name: "A", qty: 3, price: 20 }], budget: 50 })
    );
    // total = 60, budget = 50
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /budget|cost/i.test(e))).toBe(true);
  });

  it("fail: multiple items push total over budget → valid: false", () => {
    const result = validateOrder(
      makeOrder({
        items: [
          { name: "A", qty: 2, price: 15 },
          { name: "B", qty: 1, price: 30 },
        ],
        budget: 50,
      })
    );
    // total = 60, budget = 50
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => /budget|cost/i.test(e))).toBe(true);
  });
});

// ── Error collection (no short-circuit) ───────────────────────────────────

describe("error collection", () => {
  it("returns errors for multiple failing rules simultaneously", () => {
    // qty = 0 (Rule 2) AND total would exceed budget (Rule 3 — but qty=0 means total=0, so
    // use a second item to trigger Rule 3 independently)
    const result = validateOrder({
      items: [
        { name: "Bad",  qty: 0,  price: 10 },   // Rule 2: qty invalid
        { name: "Good", qty: 10, price: 100 },  // pushes total over budget
      ],
      budget:   50,
      currency: "USD",
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    // Should contain at least the qty error AND the budget error
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.some((e) => /qty/i.test(e))).toBe(true);
    expect(result.errors.some((e) => /budget|cost/i.test(e))).toBe(true);
  });
});
