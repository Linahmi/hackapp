import { z } from "zod";

export const OrderItemSchema = z.object({
  name:  z.string(),
  qty:   z.number(),
  price: z.number(),
});

export const OrderPayloadSchema = z.object({
  items:    z.array(OrderItemSchema),
  budget:   z.number(),
  currency: z.string(),
  notes:    z.string().optional(),
});

export type OrderItem   = z.infer<typeof OrderItemSchema>;
export type OrderPayload = z.infer<typeof OrderPayloadSchema>;

export type IntakeResult =
  | { success: true;  payload: OrderPayload }
  | { success: false; reason: string };
