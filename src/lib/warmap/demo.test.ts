import { describe, it, expect } from "vitest";
import { genesisTiles, isFrontline, sectorLabel } from "./demo";
import { mapShares } from "@/lib/syndicate/rules";

describe("war map simulation", () => {
  it("is deterministic and gives every faction territory", () => {
    const a = genesisTiles(), b = genesisTiles();
    expect(Object.keys(a).length).toBe(Object.keys(b).length);
    const s = mapShares(a);
    for (const f of ["DOGS", "NOT", "PEPE", "CAT", "SNOOP"]) expect(s[f]).toBeGreaterThan(0.05);
    expect(Object.keys(a).length).toBeLessThan(10000);
  });
  it("labels sectors and detects frontlines", () => {
    expect(sectorLabel(0)).toBe("A1-1");
    expect(sectorLabel(9999)).toBe("J10-100");
    expect(isFrontline({ 1: { faction: "DOGS", price: 10 } }, 0, "DOGS")).toBe(true);
    expect(isFrontline({ 1: { faction: "DOGS", price: 10 } }, 0, "NOT")).toBe(false);
  });
});
