/**
 * @file uploads.ts
 * Zod schemas for upload API routes.
 *
 * The direct upload route (POST /api/v1/uploads) receives multipart/form-data
 * which cannot be Zod-validated as a plain object — the handler validates
 * the `File` field imperatively. This file holds metadata schemas for any
 * JSON fields that accompany future uploads.
 */

import { z } from "zod";

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const allowedMimeTypeSchema = z.enum(ALLOWED_MIME_TYPES, {
  message: `File type must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`,
});
