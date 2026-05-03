import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getRedisClient } from "@/lib/redis";
import { serverConfig } from "@/server/config";

/**
 * Health check endpoint — excluded from auth middleware.
 * GET /api/health
 *
 * Always returns 200 with { status: 'ok' | 'degraded', timestamp, checks }.
 * Returns 503 only when all checks fail.
 */
export async function GET() {
  const [db, redis, horizon] = await Promise.all([
    checkDb(),
    checkRedis(),
    checkHorizon(serverConfig.stellar.horizonUrl),
  ]);

  const checks = { db, redis, horizon };
  const degraded = Object.values(checks).some((s) => s === "error");
  const status = degraded ? "degraded" : "ok";

  return NextResponse.json(
    { status, timestamp: new Date().toISOString(), checks },
    { status: degraded ? 503 : 200 }
  );
}

async function checkDb(): Promise<"ok" | "error"> {
  try {
    await pool.query("SELECT 1");
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<"ok" | "error"> {
  try {
    const client = await getRedisClient();
    await client.ping();
    return "ok";
  } catch {
    return "error";
  }
}

async function checkHorizon(url: string): Promise<"ok" | "error"> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}
