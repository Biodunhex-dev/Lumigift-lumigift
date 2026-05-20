import { getRedisClient } from "@/lib/redis";

const OTP_TTL = 600; // 10 minutes
const MAX_ATTEMPTS = 5;

/**
 * Stores a one-time password for the given phone number in Redis.
 * Any previous OTP and its attempt counter are replaced atomically.
 *
 * @param phone - E.164-formatted phone number used as the Redis key namespace.
 * @param otp - The 6-digit OTP string to store.
 * @returns Resolves when the OTP has been persisted.
 */
export async function storeOtp(phone: string, otp: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(`otp:${phone}`, otp, { EX: OTP_TTL });
  await redis.del(`otp:attempts:${phone}`);
}

export type VerifyResult =
  | { success: true }
  | { success: false; locked: boolean; message: string };

/**
 * Verifies a one-time password submitted by the user.
 *
 * Behaviour:
 * - Returns `{ success: true }` and cleans up Redis keys on a correct match.
 * - Returns `{ success: false, locked: false }` for an incorrect OTP (up to
 *   `MAX_ATTEMPTS - 1` times).
 * - Returns `{ success: false, locked: true }` and deletes the OTP once the
 *   attempt counter reaches `MAX_ATTEMPTS`, preventing brute-force attacks.
 * - Returns `{ success: false, locked: false }` when the OTP has expired or
 *   was never issued.
 *
 * @param phone - E.164-formatted phone number identifying the OTP session.
 * @param otp - The OTP string submitted by the user.
 * @returns A {@link VerifyResult} describing the outcome.
 */
export async function verifyOtp(
  phone: string,
  otp: string
): Promise<VerifyResult> {
  const redis = await getRedisClient();
  const stored = await redis.get(`otp:${phone}`);

  if (!stored) {
    return { success: false, locked: false, message: "OTP expired or not found. Please request a new one." };
  }

  const attempts = await redis.incr(`otp:attempts:${phone}`);
  if (attempts === 1) {
    // Align attempts TTL with the OTP TTL
    const ttl = await redis.ttl(`otp:${phone}`);
    if (ttl > 0) await redis.expire(`otp:attempts:${phone}`, ttl);
  }

  if (attempts > MAX_ATTEMPTS) {
    await redis.del(`otp:${phone}`);
    return { success: false, locked: true, message: "Too many failed attempts. Please request a new OTP." };
  }

  if (otp !== stored) {
    if (attempts === MAX_ATTEMPTS) {
      await redis.del(`otp:${phone}`);
      return { success: false, locked: true, message: "Too many failed attempts. Please request a new OTP." };
    }
    return { success: false, locked: false, message: "Invalid OTP." };
  }

  // Success — clean up
  await redis.del(`otp:${phone}`);
  await redis.del(`otp:attempts:${phone}`);
  return { success: true };
}
