import { describe, it, expect } from "vitest";
import { rsi, volumeSurge } from "./indicators";

describe("price feed indicators", () => {
  it("needs more than 14 closes", () => expect(rsi(Array(14).fill(1))).toBeNull());
  it("only rises → RSI 100", () => expect(rsi(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(100));
  it("only falls → RSI 0", () => expect(rsi(Array.from({ length: 20 }, (_, i) => 20 - i))).toBe(0));
  it("flat → RSI 50", () => expect(rsi(Array(20).fill(5))).toBe(50));
  it("3x surge vs prior average", () => expect(volumeSurge([10, 10, 10, 30], 3)).toBe(3));
});
