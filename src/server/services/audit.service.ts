import pool from "@/lib/db";

export type AuditEventType =
  | "gift_created"
  | "payment_received"
  | "gift_funded"
  | "gift_claimed"
  | "gift_cancelled"
  | "payment_failed"
  | "gift_refunded";

export interface AuditLogEntry {
  eventType: AuditEventType;
  userId?: string;
  giftId?: string;
  amountNgn?: number;
  amountUsdc?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Creates an audit log entry for a financial operation.
 * This function is append-only and should be called atomically with the main operation.
 *
 * @param entry - The audit log entry to create
 * @returns The created audit log ID
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<string> {
  const {
    eventType,
    userId,
    giftId,
    amountNgn,
    amountUsdc,
    ipAddress,
    userAgent,
    metadata,
  } = entry;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO audit_logs (
      event_type,
      user_id,
      gift_id,
      amount_ngn,
      amount_usdc,
      ip_address,
      user_agent,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      eventType,
      userId ?? null,
      giftId ?? null,
      amountNgn ?? null,
      amountUsdc ?? null,
      ipAddress ?? null,
      userAgent ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );

  return result.rows[0].id;
}

export interface AuditLogQuery {
  userId?: string;
  giftId?: string;
  eventType?: AuditEventType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogResult {
  id: string;
  eventType: AuditEventType;
  userId: string | null;
  giftId: string | null;
  amountNgn: number | null;
  amountUsdc: string | null;
  timestamp: Date;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Queries audit logs with optional filters.
 * Used by admin interface for compliance and dispute resolution.
 *
 * @param query - Filter criteria for audit logs
 * @returns Array of matching audit log entries
 */
export async function queryAuditLogs(
  query: AuditLogQuery
): Promise<{ logs: AuditLogResult[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (query.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(query.userId);
  }

  if (query.giftId) {
    conditions.push(`gift_id = $${paramIndex++}`);
    params.push(query.giftId);
  }

  if (query.eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(query.eventType);
  }

  if (query.startDate) {
    conditions.push(`timestamp >= $${paramIndex++}`);
    params.push(query.startDate);
  }

  if (query.endDate) {
    conditions.push(`timestamp <= $${paramIndex++}`);
    params.push(query.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
    params
  );

  const total = parseInt(countResult.rows[0].count, 10);

  const limit = query.limit ?? 50;
  const offset = query.offset ?? 0;

  const result = await pool.query<{
    id: string;
    event_type: AuditEventType;
    user_id: string | null;
    gift_id: string | null;
    amount_ngn: number | null;
    amount_usdc: string | null;
    timestamp: Date;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `SELECT
      id,
      event_type,
      user_id,
      gift_id,
      amount_ngn,
      amount_usdc,
      timestamp,
      ip_address,
      user_agent,
      metadata
    FROM audit_logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  const logs = result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    userId: row.user_id,
    giftId: row.gift_id,
    amountNgn: row.amount_ngn,
    amountUsdc: row.amount_usdc,
    timestamp: row.timestamp,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
  }));

  return { logs, total };
}
