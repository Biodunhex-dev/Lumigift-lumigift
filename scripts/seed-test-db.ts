#!/usr/bin/env ts-node
/**
 * scripts/seed-test-db.ts
 *
 * Idempotent seed script for the test database.
 * Creates: 3 users, 5 gifts in various states, 2 completed claims.
 *
 * Usage:
 *   TEST_DATABASE_URL=postgresql://... npx ts-node scripts/seed-test-db.ts
 *
 * Closes #110
 */
import { Pool } from "pg";
import { createHash } from "crypto";

const DB_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://lumigift:lumigift@localhost:5432/lumigift_test";

function hashPhone(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}

const USERS = [
  { id: "seed-user-1", phone: "+2348011111111", display_name: "Alice Obi" },
  { id: "seed-user-2", phone: "+2348022222222", display_name: "Bob Eze" },
  { id: "seed-user-3", phone: "+2348033333333", display_name: "Carol Nwosu" },
];

const now = new Date();
const past = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const future = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

const GIFTS = [
  {
    id: "seed-gift-1",
    sender_id: "seed-user-1",
    recipient_phone_hash: hashPhone("+2348022222222"),
    recipient_name: "Bob Eze",
    amount_ngn: 5000,
    amount_usdc: "3.0000000",
    status: "locked",
    unlock_at: future(7),
  },
  {
    id: "seed-gift-2",
    sender_id: "seed-user-1",
    recipient_phone_hash: hashPhone("+2348033333333"),
    recipient_name: "Carol Nwosu",
    amount_ngn: 10000,
    amount_usdc: "6.0000000",
    status: "unlocked",
    unlock_at: past(1),
  },
  {
    id: "seed-gift-3",
    sender_id: "seed-user-2",
    recipient_phone_hash: hashPhone("+2348011111111"),
    recipient_name: "Alice Obi",
    amount_ngn: 2500,
    amount_usdc: "1.5000000",
    status: "claimed",
    unlock_at: past(3),
    claim_tx_hash: "claimtxhash0000000000000000000000000000000000000000000000000001",
  },
  {
    id: "seed-gift-4",
    sender_id: "seed-user-3",
    recipient_phone_hash: hashPhone("+2348011111111"),
    recipient_name: "Alice Obi",
    amount_ngn: 7500,
    amount_usdc: "4.5000000",
    status: "claimed",
    unlock_at: past(10),
    claim_tx_hash: "claimtxhash0000000000000000000000000000000000000000000000000002",
  },
  {
    id: "seed-gift-5",
    sender_id: "seed-user-2",
    recipient_phone_hash: hashPhone("+2348033333333"),
    recipient_name: "Carol Nwosu",
    amount_ngn: 1500,
    amount_usdc: "0.9000000",
    status: "pending_payment",
    unlock_at: future(14),
  },
];

async function seed() {
  const pool = new Pool({ connectionString: DB_URL });

  try {
    // ── Schema (idempotent) ──────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        recipient_phone_hash TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        amount_ngn NUMERIC NOT NULL,
        amount_usdc TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_payment',
        unlock_at TIMESTAMPTZ NOT NULL,
        stellar_tx_hash TEXT,
        claim_tx_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS gift_invitations (
        id TEXT PRIMARY KEY,
        gift_id TEXT NOT NULL,
        recipient_phone_hash TEXT NOT NULL,
        recipient_phone TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_gift_invitations_gift_id FOREIGN KEY (gift_id) REFERENCES gifts(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_invitations_token ON gift_invitations(token)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_invitations_gift_id ON gift_invitations(gift_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_gift_invitations_recipient_phone_hash ON gift_invitations(recipient_phone_hash)
    `);

    // ── Truncate for clean state ─────────────────────────────────────────────
    await pool.query("TRUNCATE gifts, users RESTART IDENTITY CASCADE");

    // ── Users ────────────────────────────────────────────────────────────────
    for (const u of USERS) {
      await pool.query(
        `INSERT INTO users (id, phone, display_name) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone, display_name = EXCLUDED.display_name`,
        [u.id, u.phone, u.display_name]
      );
    }

    // ── Gifts ────────────────────────────────────────────────────────────────
    for (const g of GIFTS) {
      await pool.query(
        `INSERT INTO gifts
           (id, sender_id, recipient_phone_hash, recipient_name, amount_ngn, amount_usdc, status, unlock_at, claim_tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           claim_tx_hash = EXCLUDED.claim_tx_hash,
           updated_at = NOW()`,
        [
          g.id,
          g.sender_id,
          g.recipient_phone_hash,
          g.recipient_name,
          g.amount_ngn,
          g.amount_usdc,
          g.status,
          g.unlock_at,
          (g as { claim_tx_hash?: string }).claim_tx_hash ?? null,
        ]
      );
    }

    console.log(
      `✓ Seeded test DB: ${USERS.length} users, ${GIFTS.length} gifts ` +
        `(${GIFTS.filter((g) => g.status === "claimed").length} claimed)`
    );
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
