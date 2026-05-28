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

export const createGiftSchema = z.object({
  recipientPhone: e164Phone,
  recipientName: z.string().min(2, "Name must be at least 2 characters"),
  amountNgn: z
    .number()
    .min(
      parseInt(process.env.GIFT_MIN_AMOUNT_NGN ?? "500", 10),
      `Minimum gift amount is ${formatNGN(parseInt(process.env.GIFT_MIN_AMOUNT_NGN ?? "500", 10))}`
    )
    .max(
      parseInt(process.env.GIFT_MAX_AMOUNT_NGN ?? "500000", 10),
      `Maximum gift amount is ${formatNGN(parseInt(process.env.GIFT_MAX_AMOUNT_NGN ?? "500000", 10))}`
    ),
  message: z.string().max(500, "Message cannot exceed 500 characters").optional(),
  unlockAt: z
    .string()
    .datetime()
    .refine(
      (val) => new Date(val).getTime() >= Date.now() + 60 * 60 * 1000,
      "Unlock date must be at least 1 hour from now"
    ),
  paymentProvider: z.enum(["paystack", "stripe"]),
  recipientEmail: z.string().email("Enter a valid email address").optional(),
  recipientIsRegistered: z.boolean().default(true),
});

export const verifyOtpSchema = z.object({
  phone: e164Phone,
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const claimGiftSchema = z.object({
  giftId: z.string().uuid(),
  recipientStellarKey: z.string().length(56, "Invalid Stellar public key"),
});

export type CreateGiftInput = z.infer<typeof createGiftSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ClaimGiftInput = z.infer<typeof claimGiftSchema>;
