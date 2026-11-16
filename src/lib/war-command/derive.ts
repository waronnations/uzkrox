// Pure helpers for the War Command terminal: map public War Room data to
// meme agents, sector status and log severity. No new game rules.
export type SectorLite = { id: string; symbol: string; dominance: number; volume24hUsd: number };
export type SectorStatus = "apex" | "pump" | "dump";
export type Severity = "info" | "warn" | "crit";

/** One AI field agent per faction coin; avatars are the coin's real logo. */
export const AGENTS = [
  { id: "recon", name: "Recon", role: "Scouts volume spikes" },
  { id: "armor", name: "Armor", role: "Holds liquidity lines" },
  { id: "psyops", name: "Psy-ops", role: "Reads sentiment" },
  { id: "artillery", name: "Artillery", role: "Times the strikes" },
] as const;

/** Top sector is apex; others pump at or above an even share, dump below. */
export function sectorStatus(s: SectorLite, all: SectorLite[]): SectorStatus {
  const top = all.reduce((m, x) => (x.dominance > m ? x.dominance : m), 0);
  if (top > 0 && s.dominance === top) return "apex";
  return s.dominance >= 1 / Math.max(1, all.length) ? "pump" : "dump";
}

/** Hot = more than 1.5x an even share of faction volume. */
export const isHot = (s: SectorLite, all: SectorLite[]) => s.dominance > 1.5 / Math.max(1, all.length);

/** Severity from radiation: <40 info, <75 warn, else crit. */
export function radiationSeverity(level: number): Severity {
  return level >= 75 ? "crit" : level >= 40 ? "warn" : "info";
}

/** Agent confidence 0..100, stable per agent, scaled by its sector's dominance. */
export function agentConfidence(index: number, dominance: number): number {
  const base = 40 + ((index * 37) % 30);
  return Math.max(1, Math.min(99, Math.round(base + dominance * 30)));
}
