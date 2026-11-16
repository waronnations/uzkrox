// Syndicate HUD helpers (pure): next Sunday cull, harvest alert pick, cull roster and map shares from server tiles.
import { cullList, harvestSkim, mapShares, type Tile } from "./rules";

/** Next Sunday 00:00 UTC strictly after `now`. */
export function nextSundayUtc(now: number): number {
  const d = new Date(now);
  const base = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const add = (7 - d.getUTCDay()) % 7 || 7;
  return base + add * 86_400_000;
}

export function countdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

type Sig = { symbol: string; master: string; rsi: number | null; volumeX: number; harvest: boolean };
/** Strongest harvest signal (highest RSI) or null. */
export function topHarvest<T extends Sig>(signals: T[]): T | null {
  return signals.filter((s) => s.harvest && s.rsi !== null).sort((a, b) => (b.rsi ?? 0) - (a.rsi ?? 0))[0] ?? null;
}
export const projectedSkim = (s: Sig, positionUsd: number) => harvestSkim(s.rsi ?? 0, s.volumeX, positionUsd);

/** Bottom 5 non-promoted arena coins (worst rank first). */
export function cullRoster<T extends { symbol: string; rank: number; promoted: boolean }>(arena: T[]): T[] {
  return cullList(arena.map((c) => ({ ...c, score: -c.rank })));
}

/** Server tiles [idx, faction, price] → tile map + shares. */
export function tilesFromServer(rows: [number, string, number][]) {
  const tiles: Record<number, Tile> = {};
  for (const [i, faction, price] of rows) tiles[i] = { faction, price };
  return { tiles, shares: mapShares(tiles) };
}
