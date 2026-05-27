/**
 * @file admin.ts
 * Zod schemas for admin API routes.
 */

import { z } from "zod";
import { uuidSchema, isoDateSchema } from "./common";
import { giftStatusSchema } from "./gifts";

// ─── Audit event type enum ────────────────────────────────────────────────────
// Keep in sync with AuditEventType in @/server/services/audit.service

export const auditEventTypeSchema = z.enum([
  "gift_created",
  "gift_cancelled",
  "gift_claimed",
  "gift_unlocked",
  "gift_expired",
  "payment_received",
  "payment_failed",
  "payment_refunded",
  "user_registered",
  "otp_sent",
  "otp_verified",
  "suspicious_login_reported",
]);

// ─── GET /api/v1/admin/audit-logs — query params ─────────────────────────────

export const auditLogsQuerySchema = z.object({
  userId: uuidSchema.optional(),
  giftId: uuidSchema.optional(),
  eventType: auditEventTypeSchema.optional(),

  startDate: z
    .string()
    .optional()
    .refine((v) => v === undefined || !isNaN(new Date(v).getTime()), {
      message: "startDate must be a valid date string",
    })
    .transform((v) => (v !== undefined ? new Date(v) : undefined)),

  endDate: z
    .string()
    .optional()
    .refine((v) => v === undefined || !isNaN(new Date(v).getTime()), {
      message: "endDate must be a valid date string",
    })
    .transform((v) => (v !== undefined ? new Date(v) : undefined)),

  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200, "limit must be ≤ 200")),

  offset: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0, "offset must be ≥ 0")),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

// ─── GET /api/v1/admin/gifts — query params ───────────────────────────────────

export const adminGiftsQuerySchema = z.object({
  search: z.string().max(200, "search must be ≤ 200 characters").optional(),
  status: giftStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .pipe(z.number().int().min(1).max(100, "limit must be ≤ 100").optional()),
});

export type AdminGiftsQuery = z.infer<typeof adminGiftsQuerySchema>;
