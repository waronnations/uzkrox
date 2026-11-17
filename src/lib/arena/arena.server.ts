// Arena server: Top-100 roster from live market coins + paid promotions,
// persisted Death Clock start times, and the USD₮ promotion pot.
import { sql } from "@/lib/db/client.server";
import { buildArena, type ArenaToken } from "./roster";
import { PROMO_TTL_MS, USDT_MASTER, promoComment, promoExpiry, promoUnits, settledPromo, type PromoEvidence } from "./promo";
import { PROMO_MIN_USDT } from "./roster";
import { moneyLog } from "@/lib/money/config.server";

let ready: Promise<void> | null = null;
export function ensureArenaSchema() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS arena_promotions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, owner TEXT NOT NULL, master TEXT NOT NULL, symbol TEXT NOT NULL,
      amount_usdt DOUBLE PRECISION NOT NULL, status TEXT NOT NULL DEFAULT 'pending', message_hash TEXT, event_id TEXT UNIQUE,
      expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS arena_danger (master TEXT PRIMARY KEY, since TIMESTAMPTZ NOT NULL)`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

async function activePromos(now: number) {
  const r = await sql`SELECT master, SUM(amount_usdt)::float8 AS paid, MAX(expires_at) AS exp FROM arena_promotions
    WHERE status = 'confirmed' AND expires_at > ${new Date(now).toISOString()} GROUP BY master`;
  return new Map(r.rows.map((x) => [String(x["master"]), { paid: Number(x["paid"]), exp: new Date(String(x["exp"])).getTime() }]));
}

export async function vaultPotUsdt() {
  const r = await sql`SELECT COALESCE(SUM(amount_usdt), 0)::float8 AS pot FROM arena_promotions WHERE status = 'confirmed'`;
  return Number(r.rows[0]?.["pot"] ?? 0);
}

export async function arenaSnapshot(coins: { master: string; symbol: string; image: string | null; liquidityUsd: number; volume24hUsd: number; blacklisted: boolean }[], now = Date.now()) {
  await ensureArenaSchema();
  const [promos, heat, danger] = await Promise.all([
    activePromos(now),
    sql`SELECT to_master, COUNT(*)::int AS n FROM memewar_merges WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY to_master`.catch(() => ({ rows: [] as Record<string, unknown>[] })),
    sql`SELECT master, since FROM arena_danger`,
  ]);
  const heatBy = new Map(heat.rows.map((x) => [String(x["to_master"]), Number(x["n"])]));
  const since = Object.fromEntries(danger.rows.map((x) => [String(x["master"]), new Date(String(x["since"])).getTime()]));
  const images = new Map(coins.map((c) => [c.master, c.image]));
  const tokens: ArenaToken[] = coins.filter((c) => !c.blacklisted).map((c) => {
    const p = promos.get(c.master);
    return { master: c.master, symbol: c.symbol, marketCapUsd: c.liquidityUsd, volume24hUsd: c.volume24hUsd, raidHeat: heatBy.get(c.master) ?? 0, promotedUsdt: p?.paid ?? 0, promoExpiresAt: p?.exp ?? null };
  });
  const entries = buildArena(tokens, now, since);
  const inDanger = entries.filter((e) => e.deathClockEndsAt !== null && !e.promoted);
  const keep = inDanger.map((e) => e.master);
  for (const m of keep) if (!since[m]) await sql`INSERT INTO arena_danger (master, since) VALUES (${m}, ${new Date(now).toISOString()}) ON CONFLICT DO NOTHING`;
  for (const m of Object.keys(since)) if (!keep.includes(m)) await sql`DELETE FROM arena_danger WHERE master = ${m}`;
  return entries.map((e) => ({ master: e.master, symbol: e.symbol, image: images.get(e.master) ?? null, rank: e.rank, promoted: e.promoted, promoExpiresAt: e.promoExpiresAt ?? null, deathClockEndsAt: e.deathClockEndsAt }));
}

export async function preparePromo(userId: string | number, owner: string, coin: { master: string; symbol: string }, treasury: string) {
  await ensureArenaSchema();
  const id = crypto.randomUUID().replace(/-/g, "");
  await sql`INSERT INTO arena_promotions (id, user_id, owner, master, symbol, amount_usdt) VALUES (${id}, ${String(userId)}, ${owner}, ${coin.master}, ${coin.symbol}, ${PROMO_MIN_USDT})`;
  return { id, comment: promoComment(id), units: promoUnits().toString(), usdtMaster: USDT_MASTER, treasury };
}

/** Confirms via TonAPI events; replay-safe because event_id is unique. */
export async function confirmPromo(userId: string | number, id: string, hash: string | null, raw: { owner: string; treasury: string; usdt: string }, tonapiKey: string) {
  await ensureArenaSchema();
  const r = await sql`SELECT * FROM arena_promotions WHERE id = ${id} AND user_id = ${String(userId)}`;
  const row = r.rows[0];
  if (!row) throw new Error("promotion_not_found");
  if (row["status"] === "confirmed") return { status: "confirmed" as const };
  const createdAt = new Date(String(row["created_at"])).getTime();
  if (Date.now() > createdAt + PROMO_TTL_MS + 5 * 60_000) return { status: "failed" as const };
  let h = row["message_hash"] ? String(row["message_hash"]) : null;
  if (hash && !h) { h = hash; await sql`UPDATE arena_promotions SET message_hash = ${hash} WHERE id = ${id} AND message_hash IS NULL`; }
  if (!h) return { status: "pending" as const };
  const res = await fetch(`https://tonapi.io/v2/events/${h}`, { headers: { Authorization: `Bearer ${tonapiKey}` }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return { status: "pending" as const };
  if (!res.ok) { moneyLog("tonapi_error", { path: "promo_confirm", status: res.status }); throw new Error("confirmation_service_unavailable"); }
  const ev = (await res.json()) as PromoEvidence & { event_id: string };
  const status = settledPromo(ev, { owner: raw.owner, treasury: raw.treasury, usdtMaster: raw.usdt, units: promoUnits().toString(), comment: promoComment(id), createdAt });
  if (status !== "confirmed") {
    if (status === "failed") { moneyLog("settlement_mismatch", { path: "promo_confirm" }); await sql`UPDATE arena_promotions SET status = 'failed' WHERE id = ${id} AND status = 'pending'`; }
    return { status };
  }
  const cur = await sql`SELECT MAX(expires_at) AS exp FROM arena_promotions WHERE master = ${String(row["master"])} AND status = 'confirmed'`;
  const exp = cur.rows[0]?.["exp"] ? new Date(String(cur.rows[0]["exp"])).getTime() : null;
  await sql`UPDATE arena_promotions SET status = 'confirmed', event_id = ${ev.event_id}, expires_at = ${new Date(promoExpiry(Date.now(), exp)).toISOString()} WHERE id = ${id} AND status <> 'confirmed'`;
  return { status: "confirmed" as const };
}
