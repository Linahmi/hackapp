import { z } from "zod";
import { OrderPayloadSchema, type OrderPayload } from "../types/order";

export type ValidationResult =
  | { valid: true;  data: OrderPayload }
  | { valid: false; errors: string[] };

// Stricter schema for Rules 1 & 2: qty must be a positive integer.
// We rebuild around OrderPayloadSchema's shape rather than extending it so
// the extra qty constraints are local to this module.
const StrictItemSchema = z.object({
  name:  z.string(),
  qty:   z
    .number({ message: "qty is required and must be a number" })
    .refine((n) => Number.isInteger(n), { message: "qty must be an integer" })
    .refine((n) => n > 0,              { message: "qty must be > 0" }),
  price: z.number({ message: "price is required and must be a number" }),
});

const StrictPayloadSchema = z.object({
  items:    z.array(StrictItemSchema, { message: "items is required" }),
  budget:   z.number({ message: "budget is required and must be a number" }),
  currency: z.string({ message: "currency is required and must be a string" }),
  notes:    z.string().optional(),
});

export function validateOrder(order: unknown): ValidationResult {
  const errors: string[] = [];

  // ── Rules 1 & 2: schema + qty constraints ──────────────────────────────
  const parsed = StrictPayloadSchema.safeParse(order);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(issue.message);
    }
  }

  // ── Rule 3: total cost vs budget ───────────────────────────────────────
  // Run independently so we collect this error even when Rule 2 also fails.
  if (
    order !== null &&
    typeof order === "object" &&
    "items" in order &&
    Array.isArray((order as Record<string, unknown>).items) &&
    "budget" in order &&
    typeof (order as Record<string, unknown>).budget === "number"
  ) {
    const raw = order as { items: unknown[]; budget: number };
    let total = 0;
    let canCompute = true;

    for (const item of raw.items) {
      if (
        item !== null &&
        typeof item === "object" &&
        "qty" in item &&
        "price" in item &&
        typeof (item as Record<string, unknown>).qty   === "number" &&
        typeof (item as Record<string, unknown>).price === "number"
      ) {
        const i = item as { qty: number; price: number };
        total += i.qty * i.price;
      } else {
        canCompute = false;
        break;
      }
    }

    if (canCompute && total > raw.budget) {
      errors.push(
        `Total cost (${total}) exceeds budget (${raw.budget})`
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // At this point parsed.success is guaranteed true
  return { valid: true, data: (parsed as z.ZodSafeParseSuccess<OrderPayload>).data };
}
