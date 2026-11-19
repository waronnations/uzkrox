// Top-100 Coin Board ranking: most traded (24h volume) first, liquidity breaks ties.
// Pure, no I/O. Tiers: Apex #1–10, Frontline #11–95, Death Row #96–100.
export const TOP_SIZE = 100;
export type TopCoinInput = { master: string; symbol: string; name: string; image: string | null; priceUsd: number; liquidityUsd: number; volume24hUsd: number; blacklisted: boolean };
export type TopTier = "apex" | "frontline" | "deathrow";
export type TopCoin = Omit<TopCoinInput, "blacklisted"> & { rank: number; tier: TopTier };

export function tierFor(rank: number): TopTier {
  if (rank <= 10) return "apex";
  if (rank >= 96) return "deathrow";
  return "frontline";
}

export function rankTop100(coins: TopCoinInput[]): TopCoin[] {
  return coins
    .filter((c) => !c.blacklisted && c.volume24hUsd >= 0)
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd || b.liquidityUsd - a.liquidityUsd)
    .slice(0, TOP_SIZE)
    .map(({ blacklisted: _b, ...c }, i) => ({ ...c, rank: i + 1, tier: tierFor(i + 1) }));
}
