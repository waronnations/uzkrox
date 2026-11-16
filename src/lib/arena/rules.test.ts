import { describe, it, expect } from "vitest";
import { buildArena, isDelisted, DEATH_CLOCK_MS } from "./roster";
import { splitVault } from "../apocalypse/vault-split";
import { whaleAlerts } from "../whale/radar";

const tok = (i: number, extra = {}) => ({ master: `m${i}`, symbol: `T${i}`, marketCapUsd: 1000 - i, volume24hUsd: 1000 - i, raidHeat: 1000 - i, ...extra });
const now = 1_000_000;

describe("arena", () => {
  it("caps the roster at 100", () => {
    expect(buildArena(Array.from({ length: 130 }, (_, i) => tok(i)), now)).toHaveLength(100);
  });
  it("puts a 50 USD₮ promoted token first, but not a 49 USD₮ one", () => {
    const a = buildArena([tok(1), tok(50, { promotedUsdt: 50, promoExpiresAt: now + 10 * DEATH_CLOCK_MS }), tok(60, { promotedUsdt: 49, promoExpiresAt: now + 10 * DEATH_CLOCK_MS })], now);
    expect(a[0].master).toBe("m50");
    expect(a[2].master).toBe("m60");
  });
  it("starts a 6h death clock for rank 95 but not 94", () => {
    const a = buildArena(Array.from({ length: 100 }, (_, i) => tok(i)), now);
    expect(a[93].deathClockEndsAt).toBeNull();
    expect(a[94].deathClockEndsAt).toBe(now + 6 * 3_600_000);
    expect(isDelisted(a[94], now + 6 * 3_600_000)).toBe(true);
  });
});

describe("vault split", () => {
  it("splits 60/25/15", () => {
    const r = splitVault(1000, [{ id: "a", valueUsd: 100, days: 1 }], [[{ id: "f", weight: 1 }]], [{ id: "x", weight: 1 }]);
    expect(r.bunker.a).toBeCloseTo(600);
    expect(r.factions.f).toBeCloseTo(250);
    expect(r.apex.x).toBeCloseTo(150);
  });
  it("weights bunker by sqrt(value) x days", () => {
    const r = splitVault(1000, [{ id: "a", valueUsd: 400, days: 1 }, { id: "b", valueUsd: 100, days: 2 }], [], []);
    expect(r.bunker.a).toBeCloseTo(r.bunker.b); // 20*1 == 10*2
  });
  it("pays only top 10 apex players", () => {
    const r = splitVault(1000, [], [], Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, weight: 1 })));
    expect(Object.keys(r.apex)).toHaveLength(10);
  });
});

describe("whale radar", () => {
  it("keeps only listed STON.fi/DeDust swaps above $5,000", () => {
    const s = (usd: number, venue = "stonfi", master = "m1") => ({ venue, master, symbol: "X", usd, side: "buy" as const, at: 1 });
    expect(whaleAlerts([s(5000), s(5001), s(9000, "other"), s(9000, "dedust", "m2")], new Set(["m1"]))).toHaveLength(1);
  });
});
