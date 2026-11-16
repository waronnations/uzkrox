import { describe, expect, it } from "vitest";
import {
  SETTLEMENT_DAY_MS,
  SETTLEMENT_LIQUIDATION_COST_BPS,
  SETTLEMENT_WINDOW_MS,
  advanceSettlement,
  convictionFactor,
  initialSettlementState,
  projectBunkerSettlement,
  settlementLifecycle,
  survivorShares,
  survivorWeight,
  totalSurvivorWeight,
  type SettlementPoolInput,
} from "@/lib/apocalypse/bunker-settlement";

const DOOM = Date.UTC(2027, 9, 31, 18);
const pool = (overrides: Partial<SettlementPoolInput> = {}): SettlementPoolInput => ({
  id: "pool-a",
  symbol: "DOGE",
  principalUsdt: 1_000,
  stableValueUsdt: 0,
  baseValueUsdt: 500,
  coinValueUsdt: 500,
  bunkerPoolShare: 0.1,
  volume24hUsdt: 100_000,
  lpFeeBps: 20,
  liquidationCostBps: 0,
  ...overrides,
});

describe("Doomsday liquidation lifecycle", () => {
  it("keeps the bunker active before Doomsday", () => {
    const state = settlementLifecycle(DOOM - 1, DOOM);
    expect(state).toMatchObject({ phase: "bunker_active", liquidationDay: 0, completedTranches: 0, progress: 0, nextTransitionAt: DOOM });
  });

  it("opens the seven-day liquidation window exactly at Doomsday", () => {
    const state = settlementLifecycle(DOOM, DOOM);
    expect(state).toMatchObject({ phase: "liquidation_window", liquidationDay: 1, completedTranches: 0, progress: 0 });
    expect(state.claimsAt).toBe(DOOM + SETTLEMENT_WINDOW_MS);
  });

  it("advances one completed tranche per day, not by partial-day rounding", () => {
    const state = settlementLifecycle(DOOM + 3.5 * SETTLEMENT_DAY_MS, DOOM);
    expect(state).toMatchObject({ phase: "liquidation_window", liquidationDay: 4, completedTranches: 3, progress: 0.5 });
    expect(state.nextTransitionAt).toBe(DOOM + 4 * SETTLEMENT_DAY_MS);
  });

  it("opens final claims after exactly seven days and exposes claimable USD₮", () => {
    const before = projectBunkerSettlement({ now: DOOM + SETTLEMENT_WINDOW_MS - 1, asOf: DOOM, doomsdayAt: DOOM, pools: [pool()], viewerWeight: 1, totalWeight: 1 });
    const open = projectBunkerSettlement({ now: DOOM + SETTLEMENT_WINDOW_MS, asOf: DOOM, doomsdayAt: DOOM, pools: [pool()], viewerWeight: 1, totalWeight: 1 });
    expect(before.lifecycle.phase).toBe("liquidation_window");
    expect(before.claimableUsdt).toBe(0);
    expect(open.lifecycle).toMatchObject({ phase: "final_claims_open", completedTranches: 7, progress: 1, nextTransitionAt: null });
    expect(open.claimableUsdt).toBe(open.finalPoolUsdt);
  });

  it("can jump from active directly to final claims and never regresses", () => {
    const initial = initialSettlementState(DOOM);
    const final = advanceSettlement(initial, DOOM + 20 * SETTLEMENT_DAY_MS);
    expect(final.phase).toBe("final_claims_open");
    expect(advanceSettlement(final, DOOM - 100)).toBe(final);
  });
});

describe("Multi-pool USD₮ projection math", () => {
  it("accrues the bunker share of LP fees from the snapshot run-rate", () => {
    const result = projectBunkerSettlement({ now: DOOM - SETTLEMENT_DAY_MS / 2, asOf: DOOM - SETTLEMENT_DAY_MS, doomsdayAt: DOOM, pools: [pool()] });
    // 100k × 0.20% × 10% pool share = 20 USD₮/day.
    expect(result.pools[0]!.feesPerDayUsdt).toBeCloseTo(20);
    expect(result.accruedFeesUsdt).toBeCloseTo(10);
    expect(result.remainingFeesUsdt).toBeCloseTo(10);
  });

  it("stops fee accrual at Doomsday and sums a multi-pool basket", () => {
    const other = pool({ id: "pool-b", symbol: "CAT", volume24hUsdt: 50_000, bunkerPoolShare: 0.2 });
    const result = projectBunkerSettlement({ now: DOOM + SETTLEMENT_DAY_MS, asOf: DOOM - 2 * SETTLEMENT_DAY_MS, doomsdayAt: DOOM, pools: [pool(), other] });
    expect(result.accruedFeesUsdt).toBeCloseTo(40 + 40); // 20/day + 20/day for two days
    expect(result.remainingFeesUsdt).toBe(0);
  });

  it("converts base and coin legs to USD₮ while stable value avoids liquidation cost", () => {
    const result = projectBunkerSettlement({ now: DOOM, asOf: DOOM, doomsdayAt: DOOM, pools: [pool({ stableValueUsdt: 100, baseValueUsdt: 100, coinValueUsdt: 100, volume24hUsdt: 0, liquidationCostBps: SETTLEMENT_LIQUIDATION_COST_BPS })] });
    expect(result.pools[0]!.liquidationProceedsUsdt).toBeCloseTo(100 + 200 * 0.995);
    expect(result.finalPoolUsdt).toBeCloseTo(299);
    expect(SETTLEMENT_LIQUIDATION_COST_BPS).toBe(50);
  });

  it("reports realised yield per completed daily tranche", () => {
    const input = { asOf: DOOM, doomsdayAt: DOOM, pools: [pool({ stableValueUsdt: 100, baseValueUsdt: 100, coinValueUsdt: 100, volume24hUsdt: 0, liquidationCostBps: 1_000 })] };
    const active = projectBunkerSettlement({ ...input, now: DOOM });
    const halfway = projectBunkerSettlement({ ...input, now: DOOM + 3.5 * SETTLEMENT_DAY_MS });
    const final = projectBunkerSettlement({ ...input, now: DOOM + SETTLEMENT_WINDOW_MS });
    expect(active.projectedLiquidationYieldUsdt).toBe(-20);
    expect(active.realizedLiquidationYieldUsdt).toBe(0);
    expect(halfway.realizedLiquidationYieldUsdt).toBeCloseTo(-20 * 3 / 7);
    expect(final.realizedLiquidationYieldUsdt).toBe(-20);
    expect(final.finalPoolUsdt).toBe(280);
  });

  it("a dead coin loses only its own leg, not the paired base asset", () => {
    const result = projectBunkerSettlement({ now: DOOM, asOf: DOOM, doomsdayAt: DOOM, pools: [pool({ stableValueUsdt: 100, baseValueUsdt: 100, coinValueUsdt: 200, coinRecoveryRate: 0, volume24hUsdt: 0 })] });
    expect(result.finalPoolUsdt).toBe(200);
    expect(result.projectedLiquidationYieldUsdt).toBe(-200);
  });

  it("zero yield and zero fees produce a zero pool and zero cashout", () => {
    const result = projectBunkerSettlement({ now: DOOM + SETTLEMENT_WINDOW_MS, asOf: DOOM, doomsdayAt: DOOM, pools: [pool({ stableValueUsdt: 0, baseValueUsdt: 0, coinValueUsdt: 0, volume24hUsdt: 0 })], viewerWeight: 10, totalWeight: 20 });
    expect(result.finalPoolUsdt).toBe(0);
    expect(result.projectedCashoutUsdt).toBe(0);
    expect(result.claimableUsdt).toBe(0);
  });

  it("sanitises negative and non-finite market inputs", () => {
    const result = projectBunkerSettlement({ now: DOOM, asOf: DOOM, doomsdayAt: DOOM, pools: [pool({ stableValueUsdt: -10, baseValueUsdt: Number.NaN, coinValueUsdt: -100, volume24hUsdt: -1, bunkerPoolShare: 5 })], viewerWeight: -2, totalWeight: 10 });
    expect(result.currentValueUsdt).toBe(0);
    expect(result.accruedFeesUsdt).toBe(0);
    expect(result.projectedCashoutUsdt).toBe(0);
    expect(Number.isFinite(result.finalPoolUsdt)).toBe(true);
  });
});

describe("Conviction-weighted survivor shares", () => {
  it("scales linearly to full conviction at 30 days", () => {
    expect(convictionFactor(DOOM - 15 * SETTLEMENT_DAY_MS, DOOM)).toBe(0.5);
    expect(convictionFactor(DOOM - 30 * SETTLEMENT_DAY_MS, DOOM)).toBe(1);
    expect(convictionFactor(DOOM - 60 * SETTLEMENT_DAY_MS, DOOM)).toBe(1);
    expect(convictionFactor(DOOM, DOOM)).toBe(0);
  });

  it("splits the pool by √bunked value × conviction, not winner-take-all", () => {
    const survivors = [
      { id: "early", bunkedUsdt: 100, pledgedAtMs: DOOM - 30 * SETTLEMENT_DAY_MS },
      { id: "late", bunkedUsdt: 100, pledgedAtMs: DOOM - 15 * SETTLEMENT_DAY_MS },
    ];
    expect(survivorWeight(survivors[0]!, DOOM)).toBe(10);
    expect(survivorWeight(survivors[1]!, DOOM)).toBe(5);
    expect(totalSurvivorWeight(survivors, DOOM)).toBe(15);
    const payouts = survivorShares(survivors, 300, DOOM);
    expect(payouts.get("early")).toBe(200);
    expect(payouts.get("late")).toBe(100);
  });

  it("square-root scaling prevents a 4× position taking 80% against an equal holder", () => {
    const payouts = survivorShares([
      { id: "small", bunkedUsdt: 100, pledgedAtMs: DOOM - 30 * SETTLEMENT_DAY_MS },
      { id: "whale", bunkedUsdt: 400, pledgedAtMs: DOOM - 30 * SETTLEMENT_DAY_MS },
    ], 300, DOOM);
    expect(payouts.get("small")).toBe(100);
    expect(payouts.get("whale")).toBe(200);
  });

  it("combines multiple pledges belonging to one survivor", () => {
    const payouts = survivorShares([
      { id: "same", bunkedUsdt: 100, pledgedAtMs: DOOM - 30 * SETTLEMENT_DAY_MS },
      { id: "same", bunkedUsdt: 100, pledgedAtMs: DOOM - 30 * SETTLEMENT_DAY_MS },
      { id: "other", bunkedUsdt: 100, pledgedAtMs: DOOM - 30 * SETTLEMENT_DAY_MS },
    ], 300, DOOM);
    expect(payouts.get("same")).toBe(200);
    expect(payouts.get("other")).toBe(100);
  });

  it("gives no payout when every position has zero conviction", () => {
    const payouts = survivorShares([{ id: "new", bunkedUsdt: 100, pledgedAtMs: DOOM }], 300, DOOM);
    expect(payouts.get("new")).toBe(0);
  });

  it("uses survivor and total weights for projected and final claimable cashouts", () => {
    const input = { asOf: DOOM, doomsdayAt: DOOM, pools: [pool({ volume24hUsdt: 0 })], viewerWeight: 5, totalWeight: 20 };
    const active = projectBunkerSettlement({ ...input, now: DOOM });
    const claims = projectBunkerSettlement({ ...input, now: DOOM + SETTLEMENT_WINDOW_MS });
    expect(active.viewerShare).toBe(0.25);
    expect(active.projectedCashoutUsdt).toBe(250);
    expect(active.claimableUsdt).toBe(0);
    expect(claims.claimableUsdt).toBe(250);
  });
});
