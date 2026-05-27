/**
 * @file common.ts
 * Shared primitive Zod schemas reused across all route-level schemas.
 * Importable by both frontend and backend via `@/lib/schemas/common`.
 */

import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

// ─── Primitives ───────────────────────────────────────────────────────────────

/** UUID v4 string */
export const uuidSchema = z.string().uuid("Must be a valid UUID");

/**
 * E.164 phone number — accepts any recognisable format and normalises it.
 * Returns the normalised string or adds a validation issue if unrecognised.
 */
export const e164Phone = z
  .string()
  .min(1, "Phone number is required")
  .transform((val, ctx) => {
    const normalized = normalizePhone(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid phone number",
      });
      return z.NEVER;
    }
    return normalized;
  });

/**
 * ISO-8601 datetime string that validates the value is parseable as a Date.
 * Does NOT coerce — the string is kept as-is so serialisation is predictable.
 */
export const isoDateSchema = z
  .string()
  .refine((val) => !isNaN(new Date(val).getTime()), {
    message: "Must be a valid ISO 8601 date string",
  })
  .transform((val) => new Date(val));

// ─── Pagination ───────────────────────────────────────────────────────────────

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;
const DEFAULT_PAGE = 1;

/**
 * Offset-based pagination query params.
 * Accepts string inputs (from URLSearchParams) and coerces to numbers.
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1, "page must be ≥ 1")),

  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_LIMIT))
    .pipe(z.number().int().min(1).max(MAX_LIMIT, `limit must be ≤ ${MAX_LIMIT}`)),
});

/**
 * Cursor-based pagination query params.
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_LIMIT))
    .pipe(z.number().int().min(1).max(MAX_LIMIT, `pageSize must be ≤ ${MAX_LIMIT}`)),
});
