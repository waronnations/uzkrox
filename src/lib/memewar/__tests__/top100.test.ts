import { describe, expect, it } from "vitest";
import { rankTop100, tierFor } from "../top100";

const c = (m: string, v: number, l = 0, bl = false) => ({ master: m, symbol: m, name: m, image: null, priceUsd: 1, liquidityUsd: l, volume24hUsd: v, blacklisted: bl });

describe("top100", () => {
  it("ranks by 24h volume, liquidity breaks ties, drops blacklisted", () => {
    const r = rankTop100([c("a", 10), c("b", 50), c("c", 10, 99), c("x", 999, 0, true)]);
    expect(r.map((x) => x.master)).toEqual(["b", "c", "a"]);
    expect(r[0].rank).toBe(1);
  });
  it("caps at 100 and tiers apex / frontline / death row", () => {
    const r = rankTop100(Array.from({ length: 130 }, (_, i) => c(`t${i}`, 1000 - i)));
    expect(r).toHaveLength(100);
    expect([tierFor(10), tierFor(11), tierFor(95), tierFor(96)]).toEqual(["apex", "frontline", "frontline", "deathrow"]);
    expect(r[99].tier).toBe("deathrow");
  });
});
