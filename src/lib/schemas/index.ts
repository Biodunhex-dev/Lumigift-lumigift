/**
 * @file index.ts
 * Barrel export for all Lumigift Zod schemas.
 *
 * Import from `@/lib/schemas` in both frontend and backend code.
 *
 * @example
 *   import { createGiftSchema, registerBodySchema } from "@/lib/schemas";
 */

export * from "./common";
export * from "./auth";
export * from "./gifts";
export * from "./payments";
export * from "./admin";
export * from "./users";
export * from "./uploads";
