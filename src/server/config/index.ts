import { env } from "./env";

// Central server-side configuration — validated at startup.
export const serverConfig = {
  app: {
    url: env.NEXT_PUBLIC_APP_URL,
    name: env.NEXT_PUBLIC_APP_NAME,
  },
  stellar: {
    network: env.STELLAR_NETWORK,
    horizonUrl: env.STELLAR_HORIZON_URL,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    escrowContractId: env.STELLAR_ESCROW_CONTRACT_ID,
    serverSecretKey: env.STELLAR_SERVER_SECRET_KEY,
    rpcUrl: env.STELLAR_RPC_URL,
    serverPublicKey: env.STELLAR_SERVER_PUBLIC_KEY,
  },
  usdc: {
    issuer: env.USDC_ISSUER,
    assetCode: env.USDC_ASSET_CODE,
  },
  paystack: {
    secretKey: env.PAYSTACK_SECRET_KEY,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  termii: {
    apiKey: env.TERMII_API_KEY,
    senderId: env.TERMII_SENDER_ID,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "Lumigift <gifts@lumigift.com>",
  },
  redis: {
    url: env.REDIS_URL,
  },
  database: {
    url: env.DATABASE_URL,
    poolMin: env.DB_POOL_MIN,
    poolMax: env.DB_POOL_MAX,
    idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMs: env.DB_CONNECTION_TIMEOUT_MS,
  },
  giftLimits: {
    minAmountNgn: env.GIFT_MIN_AMOUNT_NGN,
    maxAmountNgn: env.GIFT_MAX_AMOUNT_NGN,
    dailyLimitNgn: env.GIFT_DAILY_LIMIT_NGN,
  },
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  },
  cron: {
    secret: env.CRON_SECRET,
  },
  auth: {
    secret: env.NEXTAUTH_SECRET,
    secretPrevious: env.NEXTAUTH_SECRET_PREVIOUS,
    rotationGraceHours: env.NEXTAUTH_ROTATION_GRACE_HOURS,
    csrfSecret: env.CSRF_SECRET,
  },
} as const;
