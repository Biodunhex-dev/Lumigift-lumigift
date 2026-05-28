import {
  createGiftSchema,
  verifyOtpSchema,
  claimGiftSchema,
  type CreateGiftInput,
  type VerifyOtpInput,
  type ClaimGiftInput,
} from "../schemas";

describe("Zod Validation Schemas", () => {
  describe("createGiftSchema", () => {
    it("should validate valid input", () => {
      const validInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        message: "Happy Birthday!",
        unlockAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
        paymentProvider: "paystack" as const,
      };

      const result = createGiftSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipientPhone).toBe("+2348012345678");
      }
    });

    it("should accept an optional recipient email if provided", () => {
      const validInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "paystack" as const,
        recipientEmail: "amara@example.com",
      };

      const result = createGiftSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipientEmail).toBe("amara@example.com");
      }
    });

    it("should reject missing required fields", () => {
      const invalidInput = {
        recipientName: "John Doe",
        amountNgn: 1000,
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it("should reject invalid types", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: "1000", // string instead of number
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject amount below minimum", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 400, // below 500
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject amount above maximum", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 15000000, // above 10M
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject past unlock date", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        unlockAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject unlock date less than 1 hour from now", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        unlockAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject oversized message", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        message: "a".repeat(501), // 501 characters
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should accept zero amount? Wait, no, minimum is 500", () => {
      // Already tested above
    });

    it("should reject invalid payment provider", () => {
      const invalidInput = {
        recipientPhone: "+2348012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "invalid",
      };

      const result = createGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should normalize phone number", () => {
      const inputWithLocalPhone = {
        recipientPhone: "08012345678",
        recipientName: "John Doe",
        amountNgn: 1000,
        unlockAt: new Date(Date.now() + 86400000).toISOString(),
        paymentProvider: "paystack",
      };

      const result = createGiftSchema.safeParse(inputWithLocalPhone);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.recipientPhone).toBe("+2348012345678");
      }
    });
  });

  describe("verifyOtpSchema", () => {
    it("should validate valid input", () => {
      const validInput = {
        phone: "+2348012345678",
        otp: "123456",
      };

      const result = verifyOtpSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject missing fields", () => {
      const invalidInput = { phone: "+2348012345678" };

      const result = verifyOtpSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid OTP length", () => {
      const invalidInput = {
        phone: "+2348012345678",
        otp: "12345", // 5 digits
      };

      const result = verifyOtpSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid phone", () => {
      const invalidInput = {
        phone: "invalid",
        otp: "123456",
      };

      const result = verifyOtpSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should normalize phone number", () => {
      const inputWithLocalPhone = {
        phone: "08012345678",
        otp: "123456",
      };

      const result = verifyOtpSchema.safeParse(inputWithLocalPhone);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone).toBe("+2348012345678");
      }
    });
  });

  describe("claimGiftSchema", () => {
    it("should validate valid input", () => {
      const validInput = {
        giftId: "550e8400-e29b-41d4-a716-446655440000",
        recipientStellarKey: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      };

      const result = claimGiftSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const invalidInput = {
        giftId: "not-a-uuid",
        recipientStellarKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      };

      const result = claimGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject invalid Stellar key length", () => {
      const invalidInput = {
        giftId: "550e8400-e29b-41d4-a716-446655440000",
        recipientStellarKey: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSG", // 55 chars
      };

      const result = claimGiftSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("Phone normalization variations", () => {
    it("should handle Nigerian phone formats", () => {
      const testCases = [
        { input: "+2348012345678", expected: "+2348012345678" },
        { input: "2348012345678", expected: "+2348012345678" },
        { input: "08012345678", expected: "+2348012345678" },
        { input: "8012345678", expected: "+2348012345678" },
      ];

      for (const { input, expected } of testCases) {
        const result = createGiftSchema.safeParse({
          recipientPhone: input,
          recipientName: "Test",
          amountNgn: 1000,
          unlockAt: new Date(Date.now() + 86400000).toISOString(),
          paymentProvider: "paystack",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.recipientPhone).toBe(expected);
        }
      }
    });

    it("should reject invalid phone formats", () => {
      const invalidPhones = ["123", "abcdefghij", "+12345678901234567890"];

      for (const phone of invalidPhones) {
        const result = createGiftSchema.safeParse({
          recipientPhone: phone,
          recipientName: "Test",
          amountNgn: 1000,
          unlockAt: new Date(Date.now() + 86400000).toISOString(),
          paymentProvider: "paystack",
        });
        expect(result.success).toBe(false);
      }
    });
  });
});