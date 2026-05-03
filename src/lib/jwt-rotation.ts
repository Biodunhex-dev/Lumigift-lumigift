/**
 * JWT key-rotation helpers for NextAuth.
 *
 * When NEXTAUTH_SECRET is rotated, set the old value in NEXTAUTH_SECRET_PREVIOUS.
 * Tokens signed with the previous secret are accepted for ROTATION_GRACE_HOURS
 * (default 24 h) so active sessions are not invalidated mid-rotation.
 *
 * Usage: pass `jwt: jwtRotationOptions` inside authOptions.
 */

import { encode, decode } from "next-auth/jwt";

/** Grace period in hours during which old tokens remain valid. */
const ROTATION_GRACE_HOURS = parseInt(
  process.env.NEXTAUTH_ROTATION_GRACE_HOURS ?? "24",
  10
);

const GRACE_MS = ROTATION_GRACE_HOURS * 60 * 60 * 1000;

export const jwtRotationOptions = {
  /**
   * Encode always uses the current NEXTAUTH_SECRET so new tokens are signed
   * with the new key immediately.
   */
  async encode(params: Parameters<typeof encode>[0]) {
    return encode(params); // uses params.secret (= NEXTAUTH_SECRET)
  },

  /**
   * Decode tries the current secret first; if that fails and a previous secret
   * is configured, it falls back to the previous secret — but only within the
   * grace window measured from the token's `iat`.
   */
  async decode(params: Parameters<typeof decode>[0]) {
    // 1. Try current secret
    try {
      const token = await decode(params);
      if (token) return token;
    } catch {
      // fall through to previous-secret attempt
    }

    // 2. Try previous secret within grace period
    const previousSecret = process.env.NEXTAUTH_SECRET_PREVIOUS;
    if (!previousSecret) return null;

    try {
      const token = await decode({ ...params, secret: previousSecret });
      if (!token) return null;

      // Enforce grace window: reject tokens older than GRACE_MS
      const iat = typeof token.iat === "number" ? token.iat * 1000 : 0;
      if (Date.now() - iat > GRACE_MS) return null;

      return token;
    } catch {
      return null;
    }
  },
};
