// Whale Radar feed: STON.fi / DeDust trades above $5,000 for the arena's top
// coins, read from GeckoTerminal's public trade index. Cached so the free API
// limit is never hit; wallet addresses are dropped (public data only).
import { whaleAlerts, WHALE_MIN_USD, type DexSwap, type WhaleAlert } from "./radar";

const API = "https://api.geckoterminal.com/api/v2/networks/ton";
const TTL_MS = 120_000;
let cache: { at: number; key: string; alerts: WhaleAlert[] } | null = null;

type Pool = { attributes: { address: string }; relationships: { dex: { data: { id: string } }; base_token: { data: { id: string } } } };
type Trade = { attributes: { kind: "buy" | "sell"; volume_in_usd: string; block_timestamp: string; tx_hash: string } };

async function gt<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function coinSwaps(c: { master: string; symbol: string }): Promise<DexSwap[]> {
  const pools = (await gt<{ data: Pool[] }>(`/tokens/${c.master}/pools?page=1`))?.data ?? [];
  const mine = pools.filter((p) => p.relationships.base_token.data.id === `ton_${c.master}` && /ston|dedust/i.test(p.relationships.dex.data.id)).slice(0, 2);
  const out: DexSwap[] = [];
  for (const p of mine) {
    const trades = (await gt<{ data: Trade[] }>(`/pools/${p.attributes.address}/trades?trade_volume_in_usd_greater_than=${WHALE_MIN_USD}`))?.data ?? [];
    for (const t of trades.slice(0, 10)) {
      out.push({ venue: p.relationships.dex.data.id, master: c.master, symbol: c.symbol, usd: Number(t.attributes.volume_in_usd), side: t.attributes.kind, at: Date.parse(t.attributes.block_timestamp) });
    }
  }
  return out;
}

export async function whaleFeed(coins: { master: string; symbol: string }[], limit = 12): Promise<WhaleAlert[]> {
  const list = coins.slice(0, 4);
  const key = list.map((c) => c.master).join(",");
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.alerts;
  const swaps = (await Promise.all(list.map(coinSwaps))).flat();
  const alerts = whaleAlerts(swaps, new Set(list.map((c) => c.master))).slice(0, limit);
  if (swaps.length || !cache) cache = { at: Date.now(), key, alerts };
  return cache.alerts;
}
