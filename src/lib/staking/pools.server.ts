// Live staking pools from TonAPI (Tonstakers, Whales, Tonkeeper queues, TF nominators). 10-minute cache.
import { isPoolKind, type PoolKind } from "./staking";

export type StakingPool = { address: string; name: string; kind: PoolKind; apy: number; minStake: string; tvl: string; liquidJetton: string | null };
let cache: { at: number; pools: StakingPool[] } | null = null;

export async function stakingPools(): Promise<StakingPool[]> {
  if (cache && Date.now() - cache.at < 600_000) return cache.pools;
  try {
    const key = process.env.TONAPI_KEY;
    const r = await fetch("https://tonapi.io/v2/staking/pools?include_unverified=false", { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`tonapi ${r.status}`);
    const d = (await r.json()) as { pools: { address: string; name: string; implementation: string; apy: number; min_stake: number; total_amount: number; verified: boolean; liquid_jetton_master?: string }[] };
    const pools = d.pools.filter((p) => p.verified && isPoolKind(p.implementation)).map((p) => ({
      address: p.address, name: p.implementation === "tf" ? `TON Nominator ${p.address.slice(-4)}` : p.name, kind: p.implementation as PoolKind,
      apy: Math.round(p.apy * 100) / 100, minStake: String(p.min_stake), tvl: String(p.total_amount), liquidJetton: p.liquid_jetton_master ?? null,
    })).sort((a, b) => Number(BigInt(a.minStake) - BigInt(b.minStake)) || b.apy - a.apy);
    cache = { at: Date.now(), pools };
  } catch (e) {
    console.error(e);
    if (!cache) return [];
  }
  return cache!.pools;
}
