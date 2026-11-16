// Anti-Market Syndicate rules (pure): War Map tiles, citadel bonus, fee routing,
// top-harvest signal, weekly culling and Doomsday survivor weight.
export const MAP_SIZE = 100;
export const TILE_BASE_GRAM = 10;
export const OVERWRITE_MULT = 1.5;
export const MAP_FEE_VAULT = 0.6; // rest goes to the marketing wallet
export const CITADEL_SHARE = 0.15;
export const HARVEST_RSI = 80;
export const HARVEST_VOLUME_X = 3;
export const HARVEST_SKIM = 0.15;
export const CULL_BOTTOM = 5;

export type Tile = { faction: string; price: number };

/** Cost to claim a tile: base when empty, 1.5× last price when occupied. */
export function tileCost(tile: Tile | null | undefined): number {
  return tile ? Math.round(tile.price * OVERWRITE_MULT * 100) / 100 : TILE_BASE_GRAM;
}

/** 60% to the War Vault, 40% to marketing. */
export function splitMapFee(amount: number) {
  const vault = Math.round(amount * MAP_FEE_VAULT * 100) / 100;
  return { vault, marketing: Math.round((amount - vault) * 100) / 100 };
}

/** Citadel multiplier: none below 15% share, scales +10%→+30% up to 45%. */
export function citadelMultiplier(share: number): number {
  if (share < CITADEL_SHARE) return 1;
  const t = Math.min(1, (share - CITADEL_SHARE) / 0.3);
  return Math.round((1.1 + 0.2 * t) * 1000) / 1000;
}

export function mapShares(tiles: Record<number, Tile>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of Object.values(tiles)) counts[t.faction] = (counts[t.faction] ?? 0) + 1;
  const total = MAP_SIZE * MAP_SIZE;
  return Object.fromEntries(Object.entries(counts).map(([f, c]) => [f, c / total]));
}

/** Bear agent: harvest when RSI > 80 and volume ≥ 3× average. Returns USD₮ to skim. */
export function harvestSkim(rsi: number, volumeX: number, positionUsd: number): number {
  return rsi > HARVEST_RSI && volumeX >= HARVEST_VOLUME_X ? Math.round(positionUsd * HARVEST_SKIM * 100) / 100 : 0;
}

/** Weekly culling: bottom 5 by score, excluding promoted coins. */
export function cullList<T extends { symbol: string; score: number; promoted?: boolean }>(coins: T[]): T[] {
  return coins.filter((c) => !c.promoted).sort((a, b) => a.score - b.score).slice(0, CULL_BOTTOM);
}

/** Weight = √value × (1 + days/7) × citadel multiplier. */
export function survivorWeight(valueUsd: number, daysLocked: number, citadel = 1): number {
  return Math.sqrt(Math.max(0, valueUsd)) * (1 + Math.max(0, daysLocked) / 7) * citadel;
}
