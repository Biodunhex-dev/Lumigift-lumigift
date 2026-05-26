// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  phone: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  stellarPublicKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Gift ─────────────────────────────────────────────────────────────────────
export type GiftStatus =
  | "draft"
  | "pending_payment"
  | "funded"
  | "locked"
  | "unlocked"
  | "claimed"
  | "expired"
  | "cancelled";

export interface Gift {
  id: string;
  senderId: string;
  /** SHA-256 hex digest of the E.164 recipient phone number. Plaintext is never persisted. */
  recipientPhoneHash: string;
  recipientName: string;
  recipientEmail?: string;
  amountNgn: number;
  amountUsdc: string; // on-chain amount as string to preserve precision
  message?: string;
  mediaUrl?: string;
  unlockAt: Date;
  status: GiftStatus;
  contractId?: string;       // Soroban escrow contract instance
  stellarTxHash?: string;    // funding transaction hash
  claimTxHash?: string;      // claim transaction hash
  createdAt: Date;
  updatedAt: Date;
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentProvider = "paystack" | "stripe";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded";

export interface Payment {
  id: string;
  giftId: string;
  provider: PaymentProvider;
  providerReference: string;
  amountNgn: number;
  status: PaymentStatus;
  createdAt: Date;
}

// ─── Notification ─────────────────────────────────────────────────────────────
export type NotificationType =
  | "gift_received"
  | "gift_unlocked"
  | "gift_claimed"
  | "otp"
  | "new_device_login"
  | "suspicious_login_reported";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Stellar ──────────────────────────────────────────────────────────────────
export interface StellarAccount {
  publicKey: string;
  sequence: string;
  balances: StellarBalance[];
}

export interface StellarBalance {
  assetCode: string;
  assetIssuer?: string;
  balance: string;
}

export interface EscrowContractState {
  contractId: string;
  sender: string;
  recipient: string;
  amountUsdc: string;
  unlockTimestamp: number;
  claimed: boolean;
}
