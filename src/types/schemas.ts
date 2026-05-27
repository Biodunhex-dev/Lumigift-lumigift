/**
 * @file schemas.ts
 * Backward-compatibility re-export shim.
 *
 * Schema definitions have been moved to `src/lib/schemas/` so they can be
 * shared between frontend and backend. All existing imports from
 * `@/types/schemas` continue to work without any changes.
 */

export {
  createGiftSchema,
  verifyOtpSchema,
  claimGiftSchema,
} from "@/lib/schemas";

export type {
  CreateGiftInput,
  VerifyOtpInput,
  ClaimGiftInput,
} from "@/lib/schemas";
