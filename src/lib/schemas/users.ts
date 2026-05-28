/**
 * @file users.ts
 * Zod schemas for user API routes.
 */

import { z } from "zod";

// ─── GET /api/v1/users — query params ────────────────────────────────────────
// Accepts the raw phone string — normalization happens in the handler
// (so we can return a specific "invalid phone" error after normalize).

export const userExistsQuerySchema = z.object({
  phone: z.string().min(1, "Phone parameter is required"),
});

export type UserExistsQuery = z.infer<typeof userExistsQuerySchema>;
