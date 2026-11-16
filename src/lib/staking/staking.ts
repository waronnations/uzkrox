// TON/GRAM staking (pure): which deposit message each pool type expects and
// how much the wallet must send. Mirrors the formats wallets like Tonkeeper use.
export type PoolKind = "liquidTF" | "whales" | "tf";
export const NANO = 1_000_000_000n;
/** Extra GRAM sent with a deposit for the pool's processing fee (unused part is returned). */
export const DEPOSIT_FEE: Record<PoolKind, bigint> = { liquidTF: NANO, whales: NANO / 5n, tf: NANO };
export const LIQUID_DEPOSIT_OP = 0x47d54391;
export const WHALES_DEPOSIT_OP = 2077040623;
export const PARTNER_CODE = 0x5b7cen;

export const isPoolKind = (k: string): k is PoolKind => k === "liquidTF" || k === "whales" || k === "tf";

export function toNanoStr(gram: string): bigint | null {
  if (!/^\d+(\.\d{1,9})?$/.test(gram.trim())) return null;
  const [w, f = ""] = gram.trim().split(".");
  return BigInt(w) * NANO + BigInt(f.padEnd(9, "0"));
}

/** Total the wallet sends; throws in plain words if below the pool minimum. */
export function depositAmount(kind: PoolKind, stakeNano: bigint, minStakeNano: bigint): bigint {
  if (stakeNano <= 0n) throw new Error("Enter an amount to stake");
  if (stakeNano < minStakeNano) throw new Error(`This pool needs at least ${Number(minStakeNano / NANO)} GRAM`);
  return stakeNano + DEPOSIT_FEE[kind];
}
