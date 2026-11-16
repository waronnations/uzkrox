import { describe, it, expect } from "vitest";
import { tileCost, splitMapFee, citadelMultiplier, harvestSkim, cullList, survivorWeight } from "./rules";

describe("syndicate rules", () => {
  it("empty tile costs 10 GRAM", () => expect(tileCost(null)).toBe(10));
  it("overwrite costs 1.5x", () => expect(tileCost({ faction: "DOGS", price: 10 })).toBe(15));
  it("fees split 60/40", () => expect(splitMapFee(10)).toEqual({ vault: 6, marketing: 4 }));
  it("no citadel below 15%", () => expect(citadelMultiplier(0.14)).toBe(1));
  it("citadel starts at +10%", () => expect(citadelMultiplier(0.15)).toBe(1.1));
  it("citadel caps at +30%", () => expect(citadelMultiplier(0.9)).toBe(1.3));
  it("harvests 15% when RSI>80 and 3x volume", () => expect(harvestSkim(85, 3, 1000)).toBe(150));
  it("no harvest at RSI 80", () => expect(harvestSkim(80, 5, 1000)).toBe(0));
  it("culls bottom 5, sparing promoted", () => {
    const coins = Array.from({ length: 8 }, (_, i) => ({ symbol: `C${i}`, score: i, promoted: i === 0 }));
    expect(cullList(coins).map((c) => c.symbol)).toEqual(["C1", "C2", "C3", "C4", "C5"]);
  });
  it("weight doubles after 7 days", () => expect(survivorWeight(100, 7)).toBe(20));
});
