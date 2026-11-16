// Bear agent live feed: daily candles from GeckoTerminal → RSI + volume surge
// → harvest flag. 15-minute cache keeps us well inside the free API limit.
import { rsi, volumeSurge } from "./indicators";
import { harvestSkim, HARVEST_RSI, HARVEST_VOLUME_X } from "./rules";

export type HarvestSignal = { master: string; symbol: string; priceUsd: number; change24h: number; rsi: number | null; volumeX: number; harvest: boolean };
const API = "https://api.geckoterminal.com/api/v2/networks/ton";
let cache: { at: number; key: string; rows: HarvestSignal[] } | null = null;

async function gt<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

async function signal(c: { master: string; symbol: string }): Promise<HarvestSignal | null> {
  const pools = (await gt<{ data: { attributes: { address: string; base_token_price_usd: string; price_change_percentage?: { h24?: string } }; relationships: { base_token: { data: { id: string } } } }[] }>(`/tokens/${c.master}/pools?page=1`))?.data ?? [];
  const p = pools.find((x) => x.relationships.base_token.data.id === `ton_${c.master}`);
  if (!p) return null;
  const o = await gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(`/pools/${p.attributes.address}/ohlcv/day?limit=30&token=base`);
  const list = (o?.data.attributes.ohlcv_list ?? []).slice().reverse(); // oldest → newest
  const r = rsi(list.map((k) => k[4]));
  const vx = volumeSurge(list.map((k) => k[5]));
  return { master: c.master, symbol: c.symbol, priceUsd: Number(p.attributes.base_token_price_usd), change24h: Number(p.attributes.price_change_percentage?.h24 ?? 0), rsi: r, volumeX: vx, harvest: harvestSkim(r ?? 0, vx, 1) > 0 };
}

export async function harvestSignals(coins: { master: string; symbol: string }[]): Promise<HarvestSignal[]> {
  const list = coins.slice(0, 6);
  const key = list.map((c) => c.master).join(",");
  if (cache && cache.key === key && Date.now() - cache.at < 900_000) return cache.rows;
  const rows = (await Promise.all(list.map(signal))).filter((x): x is HarvestSignal => !!x);
  if (rows.length || !cache) cache = { at: Date.now(), key, rows };
  return cache.rows;
}
export { HARVEST_RSI, HARVEST_VOLUME_X };
