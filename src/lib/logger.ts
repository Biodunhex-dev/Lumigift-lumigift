/**
 * Structured application logger (pino).
 *
 * In development, logs are pretty-printed to stdout.
 * In production, logs are emitted as JSON to stdout so they can be captured
 * by any log aggregation service (Logtail / Betterstack, Datadog, CloudWatch).
 *
 * Correlation IDs:
 *   - Each request is assigned a UUID correlation ID from the
 *     `x-correlation-id` header, or a new UUID is generated.
 *   - Use `requestLogger(correlationId)` to get a child logger pre-bound
 *     with the correlation ID so every log line carries it.
 *
 * Log shipping:
 *   - Set LOG_AGGREGATION_URL to your Logtail/Betterstack HTTP source URL.
 *   - Set LOG_AGGREGATION_TOKEN to the corresponding ingest token.
 *   - If neither is set, logs are written to stdout only (safe default).
 *
 * Log retention: configure 30-day retention in your aggregation service dashboard.
 */

import pino from "pino";
import { randomUUID } from "crypto";

const isDev = process.env.NODE_ENV !== "production";

function buildTransport() {
  if (isDev) {
    return {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
    };
  }
  return undefined; // plain JSON to stdout in production
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: {
      env: process.env.NODE_ENV,
      app: process.env.NEXT_PUBLIC_APP_NAME ?? "lumigift",
    },
    // Redact sensitive fields before they reach any transport
    redact: {
      paths: [
        "phone",
        "recipientPhone",
        "recipientPhoneHash",
        "*.phone",
        "*.recipientPhone",
        "req.headers.authorization",
        "req.headers.cookie",
        "*.token",
        "*.secret",
        "*.apiKey",
        "*.privateKey",
      ],
      censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  buildTransport() ? pino.transport(buildTransport()!) : undefined
);

/** Child logger pre-bound with a service name label. */
export function serviceLogger(service: string) {
  return logger.child({ service });
}

/**
 * Returns a child logger pre-bound with a correlation ID.
 * Pass the ID from the `x-correlation-id` request header, or omit to
 * generate a new UUID.
 */
export function requestLogger(correlationId?: string) {
  return logger.child({ correlationId: correlationId ?? randomUUID() });
}

/**
 * Extracts or generates a correlation ID from a Headers object.
 * Suitable for use in Next.js middleware and route handlers.
 */
export function getCorrelationId(headers: Headers): string {
  return headers.get("x-correlation-id") ?? randomUUID();
}
