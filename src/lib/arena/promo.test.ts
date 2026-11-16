import { describe, expect, it } from "vitest";
import { promoExpiry, promoUnits, settledPromo, PROMO_DAYS } from "./promo";

const x = { owner: "0:a", treasury: "0:t", usdtMaster: "0:u", units: "50000000", comment: "PROMO:abc", createdAt: 1_000_000 };
const ev = (amount: string, over: Partial<{ recipient: string; comment: string }> = {}) => ({
  timestamp: 1_100, in_progress: false,
  actions: [{ type: "JettonTransfer", status: "ok", JettonTransfer: { sender: { address: "0:a" }, recipient: { address: over.recipient ?? "0:t" }, jetton: { address: "0:u" }, amount, comment: over.comment ?? "PROMO:abc" } }],
});

describe("promoted slot payment", () => {
  it("charges exactly 50 USD₮ in 6-decimal units", () => expect(promoUnits()).toBe(50_000_000n));
  it("accepts a 50 USD₮ transfer to the vault", () => expect(settledPromo(ev("50000000"), x)).toBe("confirmed"));
  it("rejects 49.99 USD₮", () => expect(settledPromo(ev("49990000"), x)).toBe("failed"));
  it("rejects payment to another wallet or with another comment", () => {
    expect(settledPromo(ev("50000000", { recipient: "0:z" }), x)).toBe("failed");
    expect(settledPromo(ev("50000000", { comment: "PROMO:other" }), x)).toBe("failed");
  });
  it("adds 7 days on top of time still left", () => {
    const day = 86_400_000;
    expect(promoExpiry(0, null)).toBe(PROMO_DAYS * day);
    expect(promoExpiry(0, 2 * day)).toBe(9 * day);
  });
});
