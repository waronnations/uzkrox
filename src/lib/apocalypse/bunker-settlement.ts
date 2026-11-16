// Doomsday bunker settlement: deterministic USD₮ projections, conviction-weighted
// survivor shares and the seven-day liquidation lifecycle. Pure — no chain writes.
import { CONVICTION_FULL_DAYS } from "@/lib/war-cycle/cycle";

export const SETTLEMENT_DAY_MS = 86_400_000;
export const SETTLEMENT_WINDOW_DAYS = 7;
export const SETTLEMENT_WINDOW_MS = SETTLEMENT_WINDOW_DAYS * SETTLEMENT_DAY_MS;
/** Conservative modelled cost of converting non-USD₮ legs during liquidation. */
export const SETTLEMENT_LIQUIDATION_COST_BPS = 50;

export type SettlementPhase = "bunker_active" | "liquidation_window" | "final_claims_open";

export type SettlementState = {
  phase: SettlementPhase;
  doomsdayAt: number;
  claimsAt: number;
  /** 0 before Doomsday, 1–7 during the window, 7 once claims open. */
  liquidationDay: number;
  /** Completed daily unwind tranches; payouts use this discrete count. */
  completedTranches: number;
  /** Continuous visual progress through the seven-day window (0..1). */
  progress: number;
  nextTransitionAt: number | null;
};

export function initialSettlementState(doomsdayAt: number): SettlementState {
  return {
    phase: "bunker_active",
    doomsdayAt,
    claimsAt: doomsdayAt + SETTLEMENT_WINDOW_MS,
    liquidationDay: 0,
    completedTranches: 0,
    progress: 0,
    nextTransitionAt: doomsdayAt,
  };
}

/**
 * Advances the lifecycle without regressing an already-final state. A worker can
 * skip straight from active to claims; no cron or in-memory timer is required.
 */
export function advanceSettlement(state: SettlementState, now: number): SettlementState {
  if (state.phase === "final_claims_open") return state;
  if (now >= state.claimsAt) {
    return {
      ...state,
      phase: "final_claims_open",
      liquidationDay: SETTLEMENT_WINDOW_DAYS,
      completedTranches: SETTLEMENT_WINDOW_DAYS,
      progress: 1,
      nextTransitionAt: null,
    };
  }
  if (now >= state.doomsdayAt) {
    const elapsed = Math.max(0, now - state.doomsdayAt);
    const completedTranches = Math.min(SETTLEMENT_WINDOW_DAYS, Math.floor(elapsed / SETTLEMENT_DAY_MS));
    const nextTransitionAt = Math.min(state.claimsAt, state.doomsdayAt + (completedTranches + 1) * SETTLEMENT_DAY_MS);
    return {
      ...state,
      phase: "liquidation_window",
      liquidationDay: Math.min(SETTLEMENT_WINDOW_DAYS, completedTranches + 1),
      completedTranches,
      progress: Math.min(1, elapsed / SETTLEMENT_WINDOW_MS),
      nextTransitionAt,
    };
  }
  return state;
}

export function settlementLifecycle(now: number, doomsdayAt: number): SettlementState {
  return advanceSettlement(initialSettlementState(doomsdayAt), now);
}

export type BunkerSurvivor = {
  id: string;
  bunkedUsdt: number;
  pledgedAtMs: number;
};

const clean = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);
const unit = (value: number) => Math.min(1, clean(value));
const usd = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

/** Linear holding-conviction factor: 0 at pledge, 1 after 30 days. */
export function convictionFactor(pledgedAtMs: number, atMs: number): number {
  return unit((atMs - pledgedAtMs) / (CONVICTION_FULL_DAYS * SETTLEMENT_DAY_MS));
}

/** Same anti-whale curve as the game's conviction payouts: √value × time factor. */
export function survivorWeight(survivor: Pick<BunkerSurvivor, "bunkedUsdt" | "pledgedAtMs">, atMs: number): number {
  return Math.sqrt(clean(survivor.bunkedUsdt)) * convictionFactor(survivor.pledgedAtMs, atMs);
}

export function totalSurvivorWeight(survivors: BunkerSurvivor[], atMs: number): number {
  return survivors.reduce((sum, survivor) => sum + survivorWeight(survivor, atMs), 0);
}

/** Proportional, not winner-take-all. Duplicate survivor IDs are combined. */
export function survivorShares(survivors: BunkerSurvivor[], finalPoolUsdt: number, atMs: number): Map<string, number> {
  const weights = new Map<string, number>();
  for (const survivor of survivors) {
    weights.set(survivor.id, (weights.get(survivor.id) ?? 0) + survivorWeight(survivor, atMs));
  }
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const payouts = new Map<string, number>();
  for (const [id, weight] of weights) payouts.set(id, total > 0 ? usd((clean(finalPoolUsdt) * weight) / total) : 0);
  return payouts;
}

export type SettlementPoolInput = {
  id: string;
  symbol: string;
  /** Original pledge value, retained for accounting and weight inputs. */
  principalUsdt: number;
  /** Current LP mark split by asset leg; stable is already USD₮. */
  stableValueUsdt: number;
  baseValueUsdt: number;
  coinValueUsdt: number;
  /** Bunker's share of this pool's LP supply (0..1). */
  bunkerPoolShare: number;
  volume24hUsdt: number;
  lpFeeBps: number;
  /** Recovery of each non-stable leg at liquidation (0..1). */
  baseRecoveryRate?: number;
  coinRecoveryRate?: number;
  liquidationCostBps?: number;
};

export type SettlementPoolProjection = {
  id: string;
  symbol: string;
  principalUsdt: number;
  currentValueUsdt: number;
  feesPerDayUsdt: number;
  accruedFeesUsdt: number;
  remainingFeesUsdt: number;
  liquidationProceedsUsdt: number;
  projectedLiquidationYieldUsdt: number;
  realizedLiquidationYieldUsdt: number;
  finalValueUsdt: number;
};

export type BunkerSettlementProjection = {
  lifecycle: SettlementState;
  pools: SettlementPoolProjection[];
  currentValueUsdt: number;
  accruedFeesUsdt: number;
  remainingFeesUsdt: number;
  projectedLiquidationYieldUsdt: number;
  realizedLiquidationYieldUsdt: number;
  settlementValueUsdt: number;
  finalPoolUsdt: number;
  viewerShare: number;
  projectedCashoutUsdt: number;
  claimableUsdt: number;
};

/**
 * Values are marked at `asOf`; the 24h fee run-rate accrues from that snapshot to
 * Doomsday. Seven equal daily tranches realise the liquidation yield. Stable value
 * avoids conversion costs; a dead coin can recover zero without killing base assets.
 */
export function projectBunkerSettlement(input: {
  now: number;
  asOf: number;
  doomsdayAt: number;
  pools: SettlementPoolInput[];
  viewerWeight?: number;
  totalWeight?: number;
}): BunkerSettlementProjection {
  const lifecycle = settlementLifecycle(input.now, input.doomsdayAt);
  const realisedFraction = lifecycle.completedTranches / SETTLEMENT_WINDOW_DAYS;
  const pools = input.pools.map((pool) => {
    const stable = clean(pool.stableValueUsdt);
    const base = clean(pool.baseValueUsdt);
    const coin = clean(pool.coinValueUsdt);
    const currentValueUsdt = stable + base + coin;
    const feesPerDayUsdt = (clean(pool.volume24hUsdt) * clean(pool.lpFeeBps) * unit(pool.bunkerPoolShare)) / 10_000;
    const accruedMs = Math.max(0, Math.min(input.now, input.doomsdayAt) - input.asOf);
    const remainingMs = Math.max(0, input.doomsdayAt - Math.max(input.now, input.asOf));
    const accruedFeesUsdt = (feesPerDayUsdt * accruedMs) / SETTLEMENT_DAY_MS;
    const remainingFeesUsdt = (feesPerDayUsdt * remainingMs) / SETTLEMENT_DAY_MS;
    const conversionRate = 1 - unit(clean(pool.liquidationCostBps ?? SETTLEMENT_LIQUIDATION_COST_BPS) / 10_000);
    const baseRecovery = unit(pool.baseRecoveryRate ?? 1);
    const coinRecovery = unit(pool.coinRecoveryRate ?? 1);
    const liquidationProceedsUsdt = stable + (base * baseRecovery + coin * coinRecovery) * conversionRate;
    const projectedLiquidationYieldUsdt = liquidationProceedsUsdt - currentValueUsdt;
    const realizedLiquidationYieldUsdt = projectedLiquidationYieldUsdt * realisedFraction;
    return {
      id: pool.id,
      symbol: pool.symbol,
      principalUsdt: clean(pool.principalUsdt),
      currentValueUsdt,
      feesPerDayUsdt,
      accruedFeesUsdt,
      remainingFeesUsdt,
      liquidationProceedsUsdt,
      projectedLiquidationYieldUsdt,
      realizedLiquidationYieldUsdt,
      finalValueUsdt: liquidationProceedsUsdt + accruedFeesUsdt + remainingFeesUsdt,
    };
  });
  const sum = (pick: (pool: SettlementPoolProjection) => number) => pools.reduce((total, pool) => total + pick(pool), 0);
  const currentValueUsdt = sum((pool) => pool.currentValueUsdt);
  const accruedFeesUsdt = sum((pool) => pool.accruedFeesUsdt);
  const remainingFeesUsdt = sum((pool) => pool.remainingFeesUsdt);
  const projectedLiquidationYieldUsdt = sum((pool) => pool.projectedLiquidationYieldUsdt);
  const realizedLiquidationYieldUsdt = sum((pool) => pool.realizedLiquidationYieldUsdt);
  const finalPoolUsdt = sum((pool) => pool.finalValueUsdt);
  const viewerWeight = clean(input.viewerWeight ?? 0);
  const totalWeight = clean(input.totalWeight ?? 0);
  const viewerShare = totalWeight > 0 ? unit(viewerWeight / totalWeight) : 0;
  const projectedCashoutUsdt = finalPoolUsdt * viewerShare;
  return {
    lifecycle,
    pools,
    currentValueUsdt: usd(currentValueUsdt),
    accruedFeesUsdt: usd(accruedFeesUsdt),
    remainingFeesUsdt: usd(remainingFeesUsdt),
    projectedLiquidationYieldUsdt: usd(projectedLiquidationYieldUsdt),
    realizedLiquidationYieldUsdt: usd(realizedLiquidationYieldUsdt),
    settlementValueUsdt: usd(currentValueUsdt + accruedFeesUsdt + realizedLiquidationYieldUsdt),
    finalPoolUsdt: usd(finalPoolUsdt),
    viewerShare,
    projectedCashoutUsdt: usd(projectedCashoutUsdt),
    claimableUsdt: lifecycle.phase === "final_claims_open" ? usd(projectedCashoutUsdt) : 0,
  };
}
