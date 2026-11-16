// Whale Radar: keeps DEX swaps above $5,000 on STON.fi / DeDust for listed coins.
export const WHALE_MIN_USD = 5_000;
export type DexSwap = { venue: string; master: string; symbol: string; usd: number; side: "buy" | "sell"; at: number };
export type WhaleAlert = DexSwap & { tone: "green" | "amber" };

export function whaleAlerts(swaps: DexSwap[], listed: Set<string>): WhaleAlert[] {
  return swaps
    .filter((s) => s.usd > WHALE_MIN_USD && listed.has(s.master) && /ston|dedust/i.test(s.venue))
    .sort((a, b) => b.at - a.at)
    .map((s) => ({ ...s, tone: s.side === "buy" ? "green" : "amber" }));
}
