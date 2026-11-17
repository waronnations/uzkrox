import { describe, it, expect } from "vitest";
import { resolveMoneyConfig, assertMoneyReady } from "./config";
import { sectorContested, isClaimExpired, TILE_LOCK_MS, settledTile, tileNano, tileComment } from "@/lib/warmap/tiles";
import { checkRateLimit, checkRateLimitShared } from "@/lib/rate-limit.server";
import { settledPromo } from "@/lib/arena/promo";

const A = "0:" + "a".repeat(64), B = "0:" + "b".repeat(64), O = "0:" + "c".repeat(64);
const full = { MONEY_PATHS_ENABLED: "1", MARKETING_WALLET: A, CLAIM_TREASURY: B, TONAPI_KEY: "k", WAR_VAULT_SIGNER_KEY: "s" };

describe("money config fails closed", () => {
  it("refuses when flag off", () => expect(() => assertMoneyReady(resolveMoneyConfig({}))).toThrow("money_paths_disabled"));
  it("refuses when enabled but env missing", () => {
    const c = resolveMoneyConfig({ MONEY_PATHS_ENABLED: "1", TONAPI_KEY: "k" });
    expect(c.missing).toEqual(["MARKETING_WALLET", "CLAIM_TREASURY", "WAR_VAULT_SIGNER_KEY"]);
    expect(() => assertMoneyReady(c)).toThrow("config_incomplete");
  });
  it("passes with full env; signer falls back", () => {
    const { WAR_VAULT_SIGNER_KEY: _, ...rest } = full;
    expect(() => assertMoneyReady(resolveMoneyConfig({ ...rest, CLAIM_SIGNER_PRIVATE_KEY: "x" }))).not.toThrow();
  });
  it("staking defaults to mock and needs a pool to go live", () => {
    expect(resolveMoneyConfig(full).stakingProvider).toBe("mock");
    expect(resolveMoneyConfig({ ...full, STAKING_PROVIDER: "hipo" }).stakingLive).toBe(false);
    expect(resolveMoneyConfig({ ...full, STAKING_PROVIDER: "hipo", STAKING_POOL_ADDRESS: A }).stakingLive).toBe(true);
    expect(resolveMoneyConfig({ STAKING_PROVIDER: "evil" }).stakingProvider).toBe("mock");
  });
});

describe("tile race policy", () => {
  const now = 10_000_000_000;
  it("open pending contests the sector", () => expect(sectorContested([now - 1000], now)).toBe(true));
  it("expired pending does not", () => {
    expect(isClaimExpired(now - TILE_LOCK_MS - 1, now)).toBe(true);
    expect(sectorContested([now - TILE_LOCK_MS - 1], now)).toBe(false);
  });
  it("no pending → free", () => expect(sectorContested([], now)).toBe(false));
});

describe("settledTile fixtures", () => {
  const createdAt = 1_700_000_000_000, n = tileNano(1), comment = tileComment("f".repeat(32));
  const leg = (to: string, amount: bigint, c = comment) => ({ type: "TonTransfer", status: "ok", TonTransfer: { sender: { address: O }, recipient: { address: to }, amount: amount.toString(), comment: c } });
  const x = { owner: O, vault: B, marketing: A, vaultNano: n.vault, marketingNano: n.marketing, comment, createdAt };
  const ev = (actions: ReturnType<typeof leg>[], ts = createdAt / 1000 + 30) => ({ timestamp: ts, in_progress: false, actions });
  it("confirmed", () => expect(settledTile(ev([leg(B, n.vault), leg(A, n.marketing)]), x)).toBe("confirmed"));
  it("wrong amount", () => expect(settledTile(ev([leg(B, n.vault - 1n), leg(A, n.marketing)]), x)).toBe("failed"));
  it("wrong comment", () => expect(settledTile(ev([leg(B, n.vault, "TILE:x"), leg(A, n.marketing)]), x)).toBe("failed"));
  it("expired", () => expect(settledTile(ev([leg(B, n.vault), leg(A, n.marketing)], createdAt / 1000 + 3600), x)).toBe("failed"));
});

describe("settledPromo fixtures", () => {
  const createdAt = 1_700_000_000_000, U = "0:" + "d".repeat(64);
  const x = { owner: O, treasury: B, usdtMaster: U, units: "50000000", comment: "PROMO:abc", createdAt };
  const ev = (amount: string, comment = "PROMO:abc") => ({ timestamp: createdAt / 1000 + 10, in_progress: false, actions: [{ type: "JettonTransfer", status: "ok", JettonTransfer: { sender: { address: O }, recipient: { address: B }, jetton: { address: U }, amount, comment } }] });
  it("confirmed", () => expect(settledPromo(ev("50000000"), x)).toBe("confirmed"));
  it("rejects short or wrong comment", () => {
    expect(settledPromo(ev("49999999"), x)).toBe("failed");
    expect(settledPromo(ev("50000000", "PROMO:zzz"), x)).toBe("failed");
  });
});

describe("rate limit", () => {
  it("in-memory rejects after N", () => {
    const k = `t:${Math.random()}`;
    expect([1, 2, 3].map(() => checkRateLimit(k, 2, 60_000))).toEqual([true, true, false]);
  });
  it("shared uses Redis when configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://r"; process.env.UPSTASH_REDIS_REST_TOKEN = "t";
    let n = 0;
    const f = (async () => new Response(JSON.stringify([{ result: ++n }, { result: 1 }]))) as unknown as typeof fetch;
    const k = `r:${Math.random()}`;
    expect([await checkRateLimitShared(k, 2, 60_000, f), await checkRateLimitShared(k, 2, 60_000, f), await checkRateLimitShared(k, 2, 60_000, f)]).toEqual([true, true, false]);
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
});
