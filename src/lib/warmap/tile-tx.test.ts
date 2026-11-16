import { describe, it, expect } from "vitest";
import { Cell } from "@ton/core";
import { tileMessages } from "./tile-tx";
import { tileNano } from "./tiles";

describe("war map payment", () => {
  it("splits 10 GRAM into 6 + 4 with the comment on both legs", () => {
    const n = tileNano(10);
    expect(n.vault).toBe(6_000_000_000n);
    expect(n.marketing).toBe(4_000_000_000n);
    const m = tileMessages({ vault: "V", marketing: "M", vaultNano: n.vault.toString(), marketingNano: n.marketing.toString(), comment: "TILE:abc" });
    expect(m.map((x) => x.address)).toEqual(["V", "M"]);
    const s = Cell.fromBase64(m[1].payload).beginParse(); s.loadUint(32);
    expect(s.loadStringTail()).toBe("TILE:abc");
  });
  it("overwrite at 15 GRAM rounds 9 / 6", () => {
    const n = tileNano(15);
    expect([n.vault, n.marketing]).toEqual([9_000_000_000n, 6_000_000_000n]);
  });
});
