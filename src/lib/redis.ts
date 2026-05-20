import { createClient } from "redis";
import { serverConfig } from "@/server/config";

let client: ReturnType<typeof createClient> | null = null;

/**
 * Returns a connected Redis client, creating and connecting one on first call.
 * Subsequent calls return the same singleton instance.
 *
 * @returns A connected `redis` client instance.
 * @throws Will throw if the initial connection to Redis fails.
 */
export async function getRedisClient() {
  if (!client) {
    client = createClient({ url: serverConfig.redis.url });
    client.on("error", (err: Error) => console.error("[Redis]", err));
    await client.connect();
  }
  return client;
}

/**
 * Named export of the raw redis client getter for services that import `redis` directly.
 * @deprecated Use `getRedisClient()` instead.
 */
export const redis = {
  get: async (key: string) => (await getRedisClient()).get(key),
  set: async (key: string, value: string) => (await getRedisClient()).set(key, value),
  setEx: async (key: string, ttl: number, value: string) =>
    (await getRedisClient()).setEx(key, ttl, value),
  del: async (key: string) => (await getRedisClient()).del(key),
  incr: async (key: string) => (await getRedisClient()).incr(key),
  expire: async (key: string, ttl: number) => (await getRedisClient()).expire(key, ttl),
  ttl: async (key: string) => (await getRedisClient()).ttl(key),
};
