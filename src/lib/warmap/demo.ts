// War Map simulation (pure): a deterministic genesis world so players can see how
// territory, frontlines and Citadel Dominance work before any real claim exists.
// Never written to the server; live claims always come from confirmed payments.
import { MAP_SIZE, TILE_BASE_GRAM, OVERWRITE_MULT, type Tile } from "@/lib/syndicate/rules";
import { MAP_FACTIONS } from "./tiles";

export const BLOCK = 10; // 10×10 super-sectors A1..J10
export const CITADELS: Record<string, [number, number]> = { DOGS: [18, 18], NOT: [82, 18], PEPE: [18, 82], CAT: [82, 82], SNOOP: [50, 50] };

function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
}

/** Genesis world: each faction holds a blob around its citadel; the outer ring is contested/neutral. */
export function genesisTiles(seed = 7): Record<number, Tile> {
  const r = rand(seed);
  const out: Record<number, Tile> = {};
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    let best: string | null = null, bd = Infinity;
    for (const f of MAP_FACTIONS) {
      const [cx, cy] = CITADELS[f];
      const d = Math.hypot(x - cx, y - cy) * (f === "SNOOP" ? 1.25 : 1) + r() * 9;
      if (d < bd) { bd = d; best = f; }
    }
    if (best && bd < 27) {
      const price = Math.round(TILE_BASE_GRAM * Math.pow(OVERWRITE_MULT, Math.max(0, Math.floor((27 - bd) / 9))) * 100) / 100;
      out[y * MAP_SIZE + x] = { faction: best, price };
    }
  }
  return out;
}

export const blockLabel = (bx: number, by: number) => `${"ABCDEFGHIJ"[bx]}${by + 1}`;
export const sectorLabel = (idx: number) => {
  const x = idx % MAP_SIZE, y = Math.floor(idx / MAP_SIZE);
  return `${blockLabel(Math.floor(x / BLOCK), Math.floor(y / BLOCK))}-${(y % BLOCK) * BLOCK + (x % BLOCK) + 1}`;
};

/** True when the faction already holds an orthogonal neighbour (a frontline push). */
export function isFrontline(tiles: Record<number, Tile>, idx: number, faction: string): boolean {
  const x = idx % MAP_SIZE, y = Math.floor(idx / MAP_SIZE);
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < MAP_SIZE && ny < MAP_SIZE && tiles[ny * MAP_SIZE + nx]?.faction === faction;
  });
}
