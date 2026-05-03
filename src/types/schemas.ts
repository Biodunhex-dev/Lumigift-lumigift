import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const e164Phone = z
  .string()
  .transform((val, ctx) => {
    const normalized = normalizePhone(val);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return normalized;
  });

export const createGiftSchema = z.object({
  recipientPhone: e164Phone,
  recipientName: z.string().min(2, "Name must be at least 2 characters"),
  amountNgn: z
    .number()
    .min(
      parseInt(process.env.GIFT_MIN_AMOUNT_NGN ?? "500", 10),
      `Minimum gift amount is ₦${parseInt(process.env.GIFT_MIN_AMOUNT_NGN ?? "500", 10).toLocaleString()}`
    )
    .max(
      parseInt(process.env.GIFT_MAX_AMOUNT_NGN ?? "500000", 10),
      `Maximum gift amount is ₦${parseInt(process.env.GIFT_MAX_AMOUNT_NGN ?? "500000", 10).toLocaleString()}`
    ),
  message: z.string().max(500, "Message cannot exceed 500 characters").optional(),
  unlockAt: z
    .string()
    .datetime()
    .refine((val) => new Date(val) > new Date(), "Unlock date must be in the future"),
  paymentProvider: z.enum(["paystack", "stripe"]),
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
