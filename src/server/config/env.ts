import { z } from "zod";

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default("Lumigift"),

  // Auth
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_SECRET_PREVIOUS: z.string().optional(),
  NEXTAUTH_ROTATION_GRACE_HOURS: z.coerce.number().int().positive().default(24),
  CSRF_SECRET: z.string().min(32),

  // Database
  DATABASE_URL: z.string().min(1),
  DB_POOL_MIN: z.coerce.number().int().positive().default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // Stellar
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  STELLAR_ESCROW_CONTRACT_ID: z.string().min(1),
  STELLAR_SERVER_SECRET_KEY: z.string().regex(/^S[A-Z0-9]{55}$/),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_SERVER_PUBLIC_KEY: z.string().regex(/^G[A-Z0-9]{55}$/),

  // USDC
  USDC_ISSUER: z.string().regex(/^G[A-Z0-9]{55}$/),
  USDC_ASSET_CODE: z.string().default("USDC"),

  // Payments
  PAYSTACK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // SMS
  TERMII_API_KEY: z.string().min(1),
  TERMII_SENDER_ID: z.string().max(11).default("Lumigift"),

  // Cron
  CRON_SECRET: z.string().min(32),

  // Redis
  REDIS_URL: z.string().min(1),

  // Gift Limits
  GIFT_MIN_AMOUNT_NGN: z.coerce.number().int().positive().default(500),
  GIFT_MAX_AMOUNT_NGN: z.coerce.number().int().positive().default(500000),
  GIFT_DAILY_LIMIT_NGN: z.coerce.number().int().positive().default(1000000),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missingVars: string[] = [];
    const invalidVars: string[] = [];

    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      if (issue.code === "invalid_type" && "received" in issue && issue.received === "undefined") {
        missingVars.push(path);
      } else {
        invalidVars.push(`${path}: ${issue.message}`);
      }
    });

    let errorMessage = "Environment variable validation failed:\n";

    if (missingVars.length > 0) {
      errorMessage += `\nMissing required variables:\n${missingVars.map((v) => `  - ${v}`).join("\n")}`;
    }

    if (invalidVars.length > 0) {
      errorMessage += `\n\nInvalid variables:\n${invalidVars.map((v) => `  - ${v}`).join("\n")}`;
    }

    errorMessage += "\n\nPlease check your .env file and ensure all required variables are set correctly.";

    console.error(errorMessage);
    // During build (NEXT_PHASE=phase-production-build) or non-production,
    // return a stub so module-level imports don't crash.
    // At runtime with missing vars the app will fail fast on first request.
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV !== "production") {
      // Return a stub with empty strings so destructuring doesn't throw
      return new Proxy({} as Env, { get: () => "" });
    }
    process.exit(1);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

export const env = validateEnv();
