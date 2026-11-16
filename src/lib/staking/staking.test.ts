import { describe, it, expect } from "vitest";
import { depositAmount, toNanoStr, NANO } from "./staking";

describe("staking deposits", () => {
  it("parses GRAM amounts", () => expect(toNanoStr("1.5")).toBe(1_500_000_000n));
  it("rejects bad amounts", () => expect(toNanoStr("1,5")).toBeNull());
  it("Tonstakers adds 1 GRAM fee", () => expect(depositAmount("liquidTF", 10n * NANO, NANO)).toBe(11n * NANO));
  it("Whales adds 0.2 GRAM fee", () => expect(depositAmount("whales", 50n * NANO, 50n * NANO)).toBe(50n * NANO + NANO / 5n));
  it("blocks deposits under the pool minimum", () => expect(() => depositAmount("whales", 10n * NANO, 50n * NANO)).toThrow("at least 50"));
});
