import { describe, it, expect } from "vitest";
import { nextSundayUtc, topHarvest, cullRoster, tilesFromServer } from "./hud";

describe("syndicate hud", () => {
  it("next Sunday from a Monday", () => {
    expect(new Date(nextSundayUtc(Date.UTC(2026, 10, 16, 1))).toISOString()).toBe("2026-11-22T00:00:00.000Z");
  });
  it("on Sunday it rolls to next week", () => {
    expect(new Date(nextSundayUtc(Date.UTC(2026, 10, 22, 0, 0, 1))).toISOString()).toBe("2026-11-29T00:00:00.000Z");
  });
  it("picks highest-RSI harvest only", () => {
    const s = [
      { symbol: "A", master: "a", rsi: 85, volumeX: 3, harvest: true },
      { symbol: "B", master: "b", rsi: 95, volumeX: 2, harvest: false },
      { symbol: "C", master: "c", rsi: 90, volumeX: 4, harvest: true },
    ];
    expect(topHarvest(s)?.symbol).toBe("C");
    expect(topHarvest([])).toBeNull();
  });
  it("cull roster is bottom 5 non-promoted by rank", () => {
    const arena = Array.from({ length: 10 }, (_, i) => ({ symbol: `S${i + 1}`, rank: i + 1, promoted: i === 9 }));
    expect(cullRoster(arena).map((c) => c.symbol)).toEqual(["S9", "S8", "S7", "S6", "S5"]);
  });
  it("shares from server tiles", () => {
    const { shares } = tilesFromServer([[0, "DOGS", 10], [1, "DOGS", 10], [2, "NOT", 15]]);
    expect(shares.DOGS).toBeCloseTo(2 / 10000);
  });
});
