// Top-100 arena rules: promoted slots (min 50 USD₮) first, then the best tokens
// by market cap, 24h volume and raid heat. Ranks 95–100 or a promotion expiring
// within 6h start the Death Clock. Pure, no I/O.
export const ARENA_SIZE = 100;
export const PROMO_MIN_USDT = 50;
export const DEATH_CLOCK_MS = 6 * 3_600_000;
export const DANGER_RANK = 95;

export type ArenaToken = { master: string; symbol: string; marketCapUsd: number; volume24hUsd: number; raidHeat: number; promotedUsdt?: number; promoExpiresAt?: number | null };
export type ArenaEntry = ArenaToken & { rank: number; promoted: boolean; score: number; deathClockEndsAt: number | null };

export function isPromoted(t: ArenaToken, now: number) {
  return (t.promotedUsdt ?? 0) >= PROMO_MIN_USDT && (t.promoExpiresAt ?? 0) > now;
}

export function arenaScore(t: ArenaToken, maxCap: number, maxVol: number, maxHeat: number) {
  const n = (v: number, m: number) => (m > 0 ? Math.max(0, v) / m : 0);
  return 0.4 * n(t.marketCapUsd, maxCap) + 0.35 * n(t.volume24hUsd, maxVol) + 0.25 * n(t.raidHeat, maxHeat);
}

/** dangerSince: master -> when it first entered danger (kept by caller). */
export function buildArena(tokens: ArenaToken[], now: number, dangerSince: Record<string, number> = {}): ArenaEntry[] {
  const maxCap = Math.max(0, ...tokens.map((t) => t.marketCapUsd));
  const maxVol = Math.max(0, ...tokens.map((t) => t.volume24hUsd));
  const maxHeat = Math.max(0, ...tokens.map((t) => t.raidHeat));
  const scored = tokens.map((t) => ({ ...t, promoted: isPromoted(t, now), score: arenaScore(t, maxCap, maxVol, maxHeat) }));
  scored.sort((a, b) => Number(b.promoted) - Number(a.promoted) || b.score - a.score);
  return scored.slice(0, ARENA_SIZE).map((t, i) => {
    const rank = i + 1;
    const promoEnding = t.promoted && (t.promoExpiresAt ?? 0) - now <= DEATH_CLOCK_MS;
    const inDanger = (!t.promoted && rank >= DANGER_RANK) || promoEnding;
    let ends: number | null = null;
    if (promoEnding) ends = t.promoExpiresAt!;
    else if (inDanger) ends = (dangerSince[t.master] ?? now) + DEATH_CLOCK_MS;
    return { ...t, rank, deathClockEndsAt: ends };
  });
}

/** True when the clock ran out and the token should leave the arena. */
export function isDelisted(e: ArenaEntry, now: number) {
  return e.deathClockEndsAt !== null && now >= e.deathClockEndsAt;
}
