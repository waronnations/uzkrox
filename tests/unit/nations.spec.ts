import { describe, it, expect } from "vitest";
import { getReputationTier, factionLabel, NATION_FACTIONS } from "@/lib/constants/nations";
import { PROTECTION_COST } from "@/components/nations/panel-helpers";

describe("NATION_FACTIONS", () => {
  it("contains exactly wardog and warcat", () => {
    expect(NATION_FACTIONS.sort()).toEqual(["warcat", "wardog"]);
  });
});

describe("factionLabel", () => {
  it("labels known factions and falls back to Unaligned", () => {
    expect(factionLabel("wardog")).toBe("WARDOG SYNDICATE");
    expect(factionLabel("warcat")).toBe("WARCAT CABAL");
    expect(factionLabel(null)).toBe("Unaligned");
    expect(factionLabel(undefined)).toBe("Unaligned");
  });
});

describe("getReputationTier", () => {
  it("returns Recruit below 40", () => {
    expect(getReputationTier(0).tier).toBe("Shill Recruit");
  });
  it("returns Legendary at 800+", () => {
    expect(getReputationTier(800).tier).toBe("Cabal Kingpin");
  });
  it("is monotonic across boundaries", () => {
    expect(getReputationTier(39).tier).toBe("Shill Recruit");
    expect(getReputationTier(40).tier).toBe("Verified Dev");
    expect(getReputationTier(119).tier).toBe("Verified Dev");
    expect(getReputationTier(120).tier).toBe("Alpha Caller");
  });
});

describe("panel-helpers PROTECTION_COST", () => {
  it("is a positive cost for both tokens", () => {
    expect(PROTECTION_COST.wardog).toBeGreaterThan(0);
    expect(PROTECTION_COST.warcat).toBeGreaterThan(0);
  });
});
