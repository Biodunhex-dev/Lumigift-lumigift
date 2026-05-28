/**
 * @file payments.ts
 * Zod schemas for payment API routes.
 */

import { z } from "zod";
import { uuidSchema } from "./common";

// ─── GET /api/v1/payments/callback — query params ────────────────────────────

export const paystackCallbackQuerySchema = z.object({
  reference: z.string().min(1, "Payment reference is required"),
  giftId: uuidSchema,
});

export type PaystackCallbackQuery = z.infer<typeof paystackCallbackQuerySchema>;

// ─── POST /api/v1/payments — Paystack webhook payload ────────────────────────
// Applied AFTER signature verification, on the already-parsed JSON.

export const paystackWebhookSchema = z.object({
  event: z.string().min(1, "Event type is required"),
  data: z.object({
    reference: z.string().min(1, "Payment reference is required"),
    status: z.string().min(1, "Payment status is required"),
    metadata: z
      .object({
        giftId: z.string().optional(),
      })
      .optional(),
  }),
});

export type PaystackWebhookPayload = z.infer<typeof paystackWebhookSchema>;
