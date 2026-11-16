import { describe, it, expect } from "vitest";
import { settledTile, tileNano, type TileEvidence } from "./tiles";

const x = { owner: "0:a", vault: "0:v", marketing: "0:m", vaultNano: 6_000_000_000n, marketingNano: 4_000_000_000n, comment: "TILE:1", createdAt: 1_000_000 };
const leg = (to: string, amount: number, comment = "TILE:1") => ({ type: "TonTransfer", status: "ok", TonTransfer: { sender: { address: "0:a" }, recipient: { address: to }, amount, comment } });
const ev = (actions: TileEvidence["actions"]): TileEvidence => ({ timestamp: 1000, in_progress: false, actions });

describe("war map tile payments", () => {
  it("10 GRAM splits 6 vault / 4 marketing", () => expect(tileNano(10)).toEqual({ vault: 6_000_000_000n, marketing: 4_000_000_000n }));
  it("confirms when both legs paid", () => expect(settledTile(ev([leg("0:v", 6e9), leg("0:m", 4e9)]), x)).toBe("confirmed"));
  it("fails when marketing leg missing", () => expect(settledTile(ev([leg("0:v", 6e9)]), x)).toBe("failed"));
  it("fails when underpaid", () => expect(settledTile(ev([leg("0:v", 5e9), leg("0:m", 4e9)]), x)).toBe("failed"));
  it("fails on wrong comment", () => expect(settledTile(ev([leg("0:v", 6e9, "X"), leg("0:m", 4e9, "X")]), x)).toBe("failed"));
});
