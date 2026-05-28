/**
 * @file auth.ts
 * Zod schemas for authentication API routes.
 * Shared between frontend (form validation) and backend (request validation).
 */

import { z } from "zod";
import { e164Phone, uuidSchema } from "./common";

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────

export const registerBodySchema = z.object({
  phone: e164Phone,
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  /** Optional — only required when accepting a gift invitation */
  invitationToken: z.string().min(1).optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

// ─── POST /api/v1/auth/send-otp ──────────────────────────────────────────────

export const sendOtpBodySchema = z.object({
  phone: e164Phone,
});

export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;

// ─── POST or GET /api/v1/auth/report-login ───────────────────────────────────

export const reportLoginBodySchema = z.object({
  userId: uuidSchema,
  fingerprint: z.string().min(1, "Fingerprint is required"),
});

/** GET variant — same shape but accessed via query params (uid, fp) */
export const reportLoginQuerySchema = z.object({
  uid: uuidSchema,
  fp: z.string().min(1, "Fingerprint is required"),
});

export type ReportLoginBody = z.infer<typeof reportLoginBodySchema>;
export type ReportLoginQuery = z.infer<typeof reportLoginQuerySchema>;

// ─── Verify OTP (shared with frontend) ───────────────────────────────────────

export const verifyOtpSchema = z.object({
  phone: e164Phone,
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
