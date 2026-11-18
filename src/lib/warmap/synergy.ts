// War Map → Coin Board synergy (pure): a coin whose faction holds Citadel Dominance on the
// LIVE map earns boosted season points. Simulation tiles never feed this.
import { citadelMultiplier } from "@/lib/syndicate/rules";
import { MAP_FACTIONS } from "./tiles";

export function factionOf(symbol: string | null | undefined): string | null {
  const s = (symbol ?? "").replace(/^\$/, "").trim().toUpperCase();
  return (MAP_FACTIONS as readonly string[]).includes(s) ? s : null;
}

/** Multiplier for points credited to `symbol` given live map shares (1 when no dominance). */
export function synergyMult(symbol: string | null | undefined, shares: Record<string, number>): number {
  const f = factionOf(symbol);
  return f ? citadelMultiplier(shares[f] ?? 0) : 1;
}

export const boostPoints = (points: number, symbol: string | null | undefined, shares: Record<string, number>) =>
  Math.round(points * synergyMult(symbol, shares) * 100) / 100;
