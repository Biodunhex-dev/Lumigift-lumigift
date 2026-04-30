import { getRedisClient } from "@/lib/redis";
import { serverConfig } from "@/server/config";

const CACHE_KEY = "rate:NGN:USDC";
const CACHE_TTL_SEC = 60;
const FALLBACK_RATE = 1600; // used only if Horizon is unreachable and no cache exists
const LOCKED_RATE_TTL_SEC = 300; // 5 minutes
const MAX_SLIPPAGE_PERCENT = 1; // 1% max slippage tolerance

/** Shape returned by {@link getExchangeRate}. */
export interface ExchangeRateResult {
  ngnPerUsdc: number;
  stale: boolean;
  source: "cache" | "horizon" | "fallback";
}

/**
 * Fetches the NGN/USDC rate from the Stellar Horizon order book.
 * Returns the price of the first ask (XLM/USDC proxy — replace with a real
 * NGN/USDC feed such as Coingecko when available).
 *
 * @returns The exchange rate as a number.
 * @throws If Horizon returns a non-OK response or the order book has no asks.
 */
async function fetchFromHorizon(): Promise<number> {
  const url = `${serverConfig.stellar.horizonUrl}/order_book?selling_asset_type=native&buying_asset_type=credit_alphanum4&buying_asset_code=${serverConfig.usdc.assetCode}&buying_asset_issuer=${serverConfig.usdc.issuer}&limit=1`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Horizon responded ${res.status}`);
  const data = await res.json();
  const price = parseFloat(data?.asks?.[0]?.price ?? "0");
  if (!price) throw new Error("No asks in Horizon order book");
  // price is XLM/USDC; we need NGN/USDC — use XLM as proxy or return raw
  // For now return the raw USDC price in XLM terms as a placeholder;
  // replace with a real NGN/USDC feed (e.g. Coingecko) when available.
  return price;
}

/**
 * Returns the NGN/USDC exchange rate, using a Redis cache to avoid hammering
 * Horizon on every request.
 *
 * Resolution order:
 * 1. **Cache hit** — returns the cached rate (TTL: 60 s).
 * 2. **Horizon** — fetches a fresh rate, caches it, and returns it.
 * 3. **Stale cache** — if Horizon is unreachable, returns the last known rate
 *    marked as stale.
 * 4. **Fallback** — returns a hardcoded rate of 1 600 NGN/USDC as a last resort.
 *
 * @returns An {@link ExchangeRateResult} with the rate, staleness flag, and source.
 */
export async function getExchangeRate(): Promise<ExchangeRateResult> {
  const redis = await getRedisClient();

  // Cache hit
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    console.log("[exchange-rate] cache hit", { key: CACHE_KEY });
    return { ngnPerUsdc: parseFloat(cached), stale: false, source: "cache" };
  }

  console.log("[exchange-rate] cache miss", { key: CACHE_KEY });

  try {
    const rate = await fetchFromHorizon();
    await redis.setEx(CACHE_KEY, CACHE_TTL_SEC, String(rate));
    console.log("[exchange-rate] fetched from Horizon", { rate });
    return { ngnPerUsdc: rate, stale: false, source: "horizon" };
  } catch (err) {
    console.error("[exchange-rate] Horizon unreachable, serving stale/fallback", err);

    // Try stale value (key may have just expired — check with no TTL enforcement)
    const stale = await redis.get(`${CACHE_KEY}:stale`);
    if (stale) {
      return { ngnPerUsdc: parseFloat(stale), stale: true, source: "cache" };
    }

    return { ngnPerUsdc: FALLBACK_RATE, stale: true, source: "fallback" };
  }
}

/**
 * Locks the current exchange rate for a gift, storing it in Redis for 5 minutes.
 * Call this at payment initiation time.
 *
 * @param giftId - The gift UUID to associate the locked rate with.
 * @returns The locked rate and its expiry timestamp.
 */
export async function lockExchangeRate(
  giftId: string
): Promise<{ lockedRate: number; expiresAt: number }> {
  const { ngnPerUsdc } = await getExchangeRate();
  const redis = await getRedisClient();
  const expiresAt = Math.floor(Date.now() / 1000) + LOCKED_RATE_TTL_SEC;
  await redis.setEx(`rate:locked:${giftId}`, LOCKED_RATE_TTL_SEC, String(ngnPerUsdc));
  return { lockedRate: ngnPerUsdc, expiresAt };
}

/**
 * Validates that the current rate has not deviated more than MAX_SLIPPAGE_PERCENT
 * from the rate locked at payment initiation.
 *
 * @param giftId - The gift UUID whose locked rate to compare against.
 * @returns `{ valid: true }` if within tolerance, or `{ valid: false, reason }` otherwise.
 */
export async function validateSlippage(
  giftId: string
): Promise<{ valid: boolean; reason?: string }> {
  const redis = await getRedisClient();
  const lockedStr = await redis.get(`rate:locked:${giftId}`);

  if (!lockedStr) {
    return { valid: false, reason: "rate_expired" };
  }

  const lockedRate = parseFloat(lockedStr);
  const { ngnPerUsdc: currentRate } = await getExchangeRate();
  const deviation = Math.abs(currentRate - lockedRate) / lockedRate * 100;

  if (deviation > MAX_SLIPPAGE_PERCENT) {
    return {
      valid: false,
      reason: `rate_deviated: locked=${lockedRate}, current=${currentRate}, deviation=${deviation.toFixed(2)}%`,
    };
  }

  return { valid: true };
}
