import { Pool } from "pg";
import { serverConfig } from "@/server/config";

const pool = new Pool({
  connectionString: serverConfig.database.url,
  min: serverConfig.database.poolMin,
  max: serverConfig.database.poolMax,
  idleTimeoutMillis: serverConfig.database.idleTimeoutMs,
  connectionTimeoutMillis: serverConfig.database.connectionTimeoutMs,
});

pool.on("connect", () => {
  // Fires for each new physical connection added to the pool
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

/**
 * Returns current pool metrics for monitoring.
 */
export function getPoolMetrics() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount,
    maxConnections: serverConfig.database.poolMax,
    minConnections: serverConfig.database.poolMin,
  };
}

/**
 * Logs the current connection pool configuration to stdout.
 * Useful for verifying pool settings on application startup.
 */
export function logPoolMetrics() {
  console.log(
    `[db] Pool ready — min: ${serverConfig.database.poolMin}, max: ${serverConfig.database.poolMax}, ` +
      `idleTimeout: ${serverConfig.database.idleTimeoutMs}ms, connectionTimeout: ${serverConfig.database.connectionTimeoutMs}ms`
  );
}

/**
 * Gracefully drains and closes all connections in the pool.
 * Should be called during application shutdown to avoid connection leaks.
 *
 * @returns Resolves when all connections have been closed.
 */
export async function closePool() {
  await pool.end();
  console.log("[db] Pool closed.");
}

export default pool;
