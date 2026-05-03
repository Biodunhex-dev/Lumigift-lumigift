-- Migration: add gift_invitations table for unregistered recipients
-- Issue: Gifts sent to unregistered recipients need invitation tokens

CREATE TABLE IF NOT EXISTS gift_invitations (
  id TEXT PRIMARY KEY,
  gift_id TEXT NOT NULL,
  recipient_phone_hash TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, expired, claimed
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_gift_invitations_gift_id FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gift_invitations_token ON gift_invitations(token);
CREATE INDEX IF NOT EXISTS idx_gift_invitations_gift_id ON gift_invitations(gift_id);
CREATE INDEX IF NOT EXISTS idx_gift_invitations_recipient_phone_hash ON gift_invitations(recipient_phone_hash);

COMMENT ON TABLE gift_invitations IS 'Tracks invitation tokens sent to unregistered recipients for gift claims';
COMMENT ON COLUMN gift_invitations.token IS 'Unique token for gift claim link (valid for 30 days)';
COMMENT ON COLUMN gift_invitations.status IS 'Lifecycle: pending -> accepted (after registration) -> claimed (after gift claim)';
COMMENT ON COLUMN gift_invitations.expires_at IS 'Invitation expires 30 days after creation';
