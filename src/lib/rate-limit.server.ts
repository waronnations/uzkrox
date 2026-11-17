/**
 * Rate limiter for serverless.
 * - In-memory by default (single instance)
 * - Shared across instances via Upstash Redis REST when UPSTASH_REDIS_REST_URL + _TOKEN are set
 */

type Entry = { timestamps: number[] };

const store = new Map<string, Entry>();
const CLEAN_INTERVAL = 60_000;
let lastClean = Date.now();

function clean() {
  const now = Date.now();
  if (now - lastClean < CLEAN_INTERVAL) return;
  lastClean = now;
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 5 * 60_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  clean();
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= limit) return false;
  entry.timestamps.push(now);
  return true;
}

export function assertRateLimit(key: string, limit: number, windowMs: number, errorMessage = "rate_limited"): void {
  if (!checkRateLimit(key, limit, windowMs)) throw new Error(errorMessage);
}

/** Fixed-window counter in Redis (INCR + PEXPIRE NX). Falls back to memory on any Redis failure. */
export async function checkRateLimitShared(key: string, limit: number, windowMs: number, fetcher: typeof fetch = fetch): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return checkRateLimit(key, limit, windowMs);
  const bucket = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  try {
    const r = await fetcher(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", bucket], ["PEXPIRE", bucket, String(windowMs), "NX"]]),
      signal: AbortSignal.timeout(2000),
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    const out = (await r.json()) as { result: number }[];
    return Number(out[0]?.result ?? 0) <= limit;
  } catch (e) {
    console.warn(JSON.stringify({ scope: "money", event: "redis_fallback", error: String(e) }));
    return checkRateLimit(key, limit, windowMs);
  }
}

export async function assertRateLimitShared(key: string, limit: number, windowMs: number): Promise<void> {
  if (!(await checkRateLimitShared(key, limit, windowMs))) {
    console.warn(JSON.stringify({ scope: "money", event: "rate_limited", key: key.split(":")[0] }));
    throw new Error("rate_limited");
  }
}

/** Convenience helpers used by game actions */
export function assertMergeRate(userId: string) { assertRateLimit(`merge:${userId}`, 12, 10_000); }
export function assertSpawnRate(userId: string) { assertRateLimit(`spawn:${userId}`, 8, 10_000); }
export function assertSwapRate(userId: string) { assertRateLimit(`swap:${userId}`, 15, 10_000); }
export function assertClaimRate(userId: string) { assertRateLimit(`claim:${userId}`, 3, 60_000); }
