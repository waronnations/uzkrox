import { describe, expect, it } from "vitest";
import { boostPoints, factionOf, synergyMult } from "./synergy";

describe("war map synergy", () => {
  it("maps coin symbols to map factions", () => {
    expect(factionOf("$dogs")).toBe("DOGS");
    expect(factionOf("USDT")).toBeNull();
  });
  it("no boost below 15% citadel share", () => {
    expect(synergyMult("DOGS", { DOGS: 0.1 })).toBe(1);
  });
  it("boosts points +10% at 15% and +30% at 45%", () => {
    expect(boostPoints(100, "DOGS", { DOGS: 0.15 })).toBe(110);
    expect(boostPoints(100, "PEPE", { PEPE: 0.5 })).toBe(130);
  });
  it("non-faction coins are never boosted", () => {
    expect(boostPoints(100, "TON", { DOGS: 0.9 })).toBe(100);
  });
});
