import { describe, it, expect } from "vitest";
import { depositBody } from "./deposit-body";
import { LIQUID_DEPOSIT_OP, WHALES_DEPOSIT_OP, depositAmount, NANO } from "./staking";

describe("staking deposit body", () => {
  it("liquid uses LIQUID_DEPOSIT_OP", () => expect(depositBody("liquidTF").beginParse().loadUint(32)).toBe(LIQUID_DEPOSIT_OP));
  it("whales uses WHALES_DEPOSIT_OP", () => expect(depositBody("whales").beginParse().loadUint(32)).toBe(WHALES_DEPOSIT_OP));
  it("nominator uses text 'd'", () => { const s = depositBody("tf").beginParse(); expect(s.loadUint(32)).toBe(0); expect(s.loadStringTail()).toBe("d"); });
  it("adds fee and enforces minimum", () => {
    expect(depositAmount("whales", 50n * NANO, 50n * NANO)).toBe(50n * NANO + NANO / 5n);
    expect(() => depositAmount("tf", NANO, 10_000n * NANO)).toThrow(/at least/);
  });
});
