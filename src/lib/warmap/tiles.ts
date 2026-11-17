// Paid War Map claims (pure): GRAM split between War Vault and marketing,
// and the on-chain proof check for both transfers.
import { splitMapFee } from "@/lib/syndicate/rules";
export const TILE_TTL_MS = 15 * 60_000;
export const MAP_FACTIONS = ["DOGS", "NOT", "PEPE", "CAT", "SNOOP"] as const;
export const tileComment = (id: string) => `TILE:${id.slice(0, 18)}`;

export function tileNano(costGram: number) {
  const { vault, marketing } = splitMapFee(costGram);
  return { vault: BigInt(Math.round(vault * 1e9)), marketing: BigInt(Math.round(marketing * 1e9)) };
}

export type TileEvidence = {
  timestamp: number; in_progress: boolean; is_scam?: boolean;
  actions: { type: string; status: string; TonTransfer?: { sender?: { address: string }; recipient?: { address: string }; amount: number | string; comment?: string } }[];
};

/** Confirmed only when both legs (vault + marketing) came from the owner with the claim comment. */
export function settledTile(e: TileEvidence, x: { owner: string; vault: string; marketing: string; vaultNano: bigint; marketingNano: bigint; comment: string; createdAt: number }) {
  if (e.in_progress) return "pending" as const;
  const t = e.timestamp * 1000;
  if (e.is_scam || t < x.createdAt - 60_000 || t > x.createdAt + TILE_TTL_MS) return "failed" as const;
  const leg = (to: string, min: bigint) => e.actions.some((a) => {
    const v = a.TonTransfer;
    return a.type === "TonTransfer" && a.status === "ok" && !!v && v.sender?.address === x.owner && v.recipient?.address === to
      && /^\d+$/.test(String(v.amount)) && BigInt(String(v.amount)) >= min && v.comment === x.comment;
  });
  return leg(x.vault, x.vaultNano) && leg(x.marketing, x.marketingNano) ? ("confirmed" as const) : ("failed" as const);
}

/** A pending claim keeps its sector locked for the payment window plus 5 min of confirmation slack. */
export const TILE_LOCK_MS = TILE_TTL_MS + 5 * 60_000;
export const isClaimExpired = (createdAt: number, now: number) => now > createdAt + TILE_LOCK_MS;

/**
 * Race policy: ONE open (non-expired, pending) claim per sector. A second prepare on the same
 * sector while one is open is "sector_contested", so two players can never both pay for it.
 */
export function sectorContested(openPendingCreatedAts: number[], now: number) {
  return openPendingCreatedAts.some((c) => !isClaimExpired(c, now));
}
