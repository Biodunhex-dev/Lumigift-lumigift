import { randomBytes } from "crypto";
import pool from "@/lib/db";

/**
 * Creates a unique invitation token for unregistered gift recipients.
 * The token is valid for 30 days.
 *
 * @param giftId - The UUID of the gift.
 * @param recipientPhoneHash - The SHA256 hash of the recipient's phone number.
 * @param recipientPhone - The E.164-formatted recipient phone number (for creating invitation link).
 * @returns The invitation token string.
 */
export async function createGiftInvitation(
  giftId: string,
  recipientPhoneHash: string,
  recipientPhone: string
): Promise<string> {
  const invitationId = randomBytes(16).toString("hex");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await pool.query(
    `INSERT INTO gift_invitations (id, gift_id, recipient_phone_hash, recipient_phone, token, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [invitationId, giftId, recipientPhoneHash, recipientPhone, token, expiresAt]
  );

  return token;
}

/**
 * Validates an invitation token.
 *
 * @param token - The invitation token.
 * @returns The invitation details if valid, or null if invalid/expired.
 */
export async function validateInvitationToken(
  token: string
): Promise<{
  id: string;
  giftId: string;
  recipientPhoneHash: string;
  recipientPhone: string;
  expiresAt: Date;
} | null> {
  const { rows } = await pool.query(
    `SELECT id, gift_id, recipient_phone_hash, recipient_phone, expires_at
     FROM gift_invitations
     WHERE token = $1 AND status = 'pending' AND expires_at > NOW()`,
    [token]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    giftId: row.gift_id,
    recipientPhoneHash: row.recipient_phone_hash,
    recipientPhone: row.recipient_phone,
    expiresAt: new Date(row.expires_at),
  };
}

/**
 * Marks an invitation as accepted (after the recipient registers).
 *
 * @param invitationId - The invitation record ID.
 * @returns True if updated successfully, false if not found.
 */
export async function acceptInvitation(invitationId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE gift_invitations SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
    [invitationId]
  );
  return rowCount > 0;
}

/**
 * Marks an invitation as claimed (after the gift is claimed).
 *
 * @param invitationId - The invitation record ID.
 * @returns True if updated successfully, false if not found.
 */
export async function claimInvitation(invitationId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE gift_invitations SET status = 'claimed', updated_at = NOW() WHERE id = $1`,
    [invitationId]
  );
  return rowCount > 0;
}

/**
 * Retrieves invitation details by phone and gift ID (used during claim).
 *
 * @param recipientPhone - The E.164-formatted phone number.
 * @param giftId - The gift UUID.
 * @returns The invitation details if found and valid, otherwise null.
 */
export async function getInvitationByPhoneAndGift(
  recipientPhone: string,
  giftId: string
): Promise<{
  id: string;
  status: string;
} | null> {
  const { rows } = await pool.query(
    `SELECT id, status FROM gift_invitations
     WHERE recipient_phone = $1 AND gift_id = $2 AND expires_at > NOW()`,
    [recipientPhone, giftId]
  );

  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    status: rows[0].status,
  };
}
