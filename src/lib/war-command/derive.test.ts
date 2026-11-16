import { describe, expect, it } from "vitest";
import { agentConfidence, isHot, radiationSeverity, sectorStatus } from "./derive";

const all = [
  { id: "a", symbol: "A", dominance: 0.55, volume24hUsd: 1 },
  { id: "b", symbol: "B", dominance: 0.35, volume24hUsd: 1 },
  { id: "c", symbol: "C", dominance: 0.1, volume24hUsd: 1 },
];
describe("war command derive", () => {
  it("marks top sector apex, above even share pump, below dump", () => {
    expect(sectorStatus(all[0], all)).toBe("apex");
    expect(sectorStatus(all[1], all)).toBe("pump");
    expect(sectorStatus(all[2], all)).toBe("dump");
  });
  it("hot above 1.5x even share", () => {
    expect(isHot(all[0], all)).toBe(true);
    expect(isHot(all[1], all)).toBe(false);
  });
  it("radiation severity bands", () => {
    expect(radiationSeverity(39)).toBe("info");
    expect(radiationSeverity(40)).toBe("warn");
    expect(radiationSeverity(75)).toBe("crit");
  });
  it("confidence stays in 1..99", () => {
    expect(agentConfidence(0, 1)).toBe(70);
    expect(agentConfidence(5, 5)).toBe(99);
  });
});
