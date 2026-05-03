-- Migration: add audit logging for financial operations
-- Issue #99: Implement audit logging for all financial operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT,
  gift_id TEXT,
  amount_ngn INTEGER,
  amount_usdc TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_gift_id ON audit_logs(gift_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

-- Prevent updates and deletes (append-only)
CREATE OR REPLACE RULE audit_logs_no_update AS
  ON UPDATE TO audit_logs
  DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_logs_no_delete AS
  ON DELETE TO audit_logs
  DO INSTEAD NOTHING;

COMMENT ON TABLE audit_logs IS 'Append-only audit trail for financial operations. Retained for 7 years minimum for compliance.';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of financial event: gift_created, payment_received, gift_funded, gift_claimed, gift_cancelled';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context: payment provider, transaction hashes, error details, etc.';
