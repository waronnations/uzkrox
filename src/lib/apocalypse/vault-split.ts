// Doomsday USD₮ War Vault split: 60% bunker survivors (sqrt(value) × days),
// 25% top-3 faction holders, 15% top-10 apex players. Pure projections only.
export const SPLIT = { bunker: 0.6, factions: 0.25, apex: 0.15 } as const;

export type BunkerStake = { id: string; valueUsd: number; days: number };
export type Holder = { id: string; weight: number };

export function conviction(s: BunkerStake) {
  return Math.sqrt(Math.max(0, s.valueUsd)) * Math.max(0, s.days);
}

function prorata(pot: number, items: { id: string; w: number }[]) {
  const total = items.reduce((a, b) => a + b.w, 0);
  const out: Record<string, number> = {};
  for (const i of items) out[i.id] = (out[i.id] ?? 0) + (total > 0 ? (pot * i.w) / total : 0);
  return out;
}

export function splitVault(potUsdt: number, stakes: BunkerStake[], factionHolders: Holder[][], apex: Holder[]) {
  const pot = Math.max(0, potUsdt);
  const pools = { bunker: pot * SPLIT.bunker, factions: pot * SPLIT.factions, apex: pot * SPLIT.apex };
  const bunker = prorata(pools.bunker, stakes.map((s) => ({ id: s.id, w: conviction(s) })));
  const top3 = factionHolders.slice(0, 3);
  const perFaction = top3.length ? pools.factions / top3.length : 0;
  const factions: Record<string, number> = {};
  for (const f of top3) for (const [k, v] of Object.entries(prorata(perFaction, f.map((h) => ({ id: h.id, w: h.weight }))))) factions[k] = (factions[k] ?? 0) + v;
  const apexOut = prorata(pools.apex, apex.slice(0, 10).map((h) => ({ id: h.id, w: h.weight })));
  return { pools, bunker, factions, apex: apexOut };
}
