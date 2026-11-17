// War Map server: tile ownership + paid claims verified on TonAPI before a tile changes hands.
import { sql } from "@/lib/db/client.server";
import { tileCost, MAP_SIZE } from "@/lib/syndicate/rules";
import { settledTile, tileComment, tileNano, isClaimExpired, sectorContested, TILE_LOCK_MS, MAP_FACTIONS, type TileEvidence } from "./tiles";
import { moneyLog } from "@/lib/money/config.server";

let ready: Promise<void> | null = null;
export function ensureWarMapSchema() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS war_map_tiles (idx INT PRIMARY KEY, faction TEXT NOT NULL, price DOUBLE PRECISION NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS war_map_claims (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, owner TEXT NOT NULL, idx INT NOT NULL, faction TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL, status TEXT NOT NULL DEFAULT 'pending', message_hash TEXT, event_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`UPDATE war_map_claims c SET status = 'expired' WHERE status = 'pending' AND EXISTS (SELECT 1 FROM war_map_claims d WHERE d.idx = c.idx AND d.status = 'pending' AND d.created_at > c.created_at)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS war_map_claims_one_open ON war_map_claims (idx) WHERE status = 'pending'`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/** Public map: tile index → faction + last price. No owners. */
export async function warMapTiles() {
  await ensureWarMapSchema();
  const r = await sql`SELECT idx, faction, price FROM war_map_tiles`;
  return r.rows.map((x) => [Number(x["idx"]), String(x["faction"]), Number(x["price"])] as [number, string, number]);
}

// Race policy (see sectorContested): one open pending claim per sector; stale pendings expire first.
// Confirm is idempotent (event_id UNIQUE, status check) and only a confirmed claim writes the tile;
// the price never drops (GREATEST on confirm).
export async function prepareTile(userId: string | number, owner: string, idx: number, faction: string) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= MAP_SIZE * MAP_SIZE) throw new Error("bad_tile");
  if (!(MAP_FACTIONS as readonly string[]).includes(faction)) throw new Error("bad_faction");
  await ensureWarMapSchema();
  const now = Date.now();
  await sql`UPDATE war_map_claims SET status = 'expired' WHERE status = 'pending' AND created_at < ${new Date(now - TILE_LOCK_MS).toISOString()}`;
  const cur = (await sql`SELECT faction, price FROM war_map_tiles WHERE idx = ${idx}`).rows[0];
  if (cur && String(cur["faction"]) === faction) throw new Error("faction_holds_sector");
  const open = await sql`SELECT created_at FROM war_map_claims WHERE idx = ${idx} AND status = 'pending'`;
  if (sectorContested(open.rows.map((r) => new Date(String(r["created_at"])).getTime()), now)) {
    moneyLog("sector_contested", { idx });
    throw new Error("sector_contested");
  }
  const cost = tileCost(cur ? { faction: String(cur["faction"]), price: Number(cur["price"]) } : null);
  const id = crypto.randomUUID().replace(/-/g, "");
  try {
    await sql`INSERT INTO war_map_claims (id, user_id, owner, idx, faction, amount) VALUES (${id}, ${String(userId)}, ${owner}, ${idx}, ${faction}, ${cost})`;
  } catch (e) {
    // Partial unique index on (idx) WHERE pending closes the check-then-insert gap.
    if (/duplicate|unique/i.test(String(e))) { moneyLog("sector_contested", { idx }); throw new Error("sector_contested"); }
    throw e;
  }
  const n = tileNano(cost);
  return { id, cost, comment: tileComment(id), vaultNano: n.vault.toString(), marketingNano: n.marketing.toString() };
}

export type TileStatus = "pending" | "confirmed" | "failed" | "expired";

export async function confirmTile(userId: string | number, id: string, hash: string | null, raw: { owner: string; vault: string; marketing: string }, tonapiKey: string): Promise<{ status: TileStatus }> {
  await ensureWarMapSchema();
  const row = (await sql`SELECT * FROM war_map_claims WHERE id = ${id} AND user_id = ${String(userId)}`).rows[0];
  if (!row) throw new Error("claim_not_found");
  const st = String(row["status"]);
  if (st === "confirmed" || st === "failed" || st === "expired") return { status: st as TileStatus };
  const createdAt = new Date(String(row["created_at"])).getTime();
  if (isClaimExpired(createdAt, Date.now())) {
    await sql`UPDATE war_map_claims SET status = 'expired' WHERE id = ${id} AND status = 'pending'`;
    return { status: "expired" };
  }
  let h = row["message_hash"] ? String(row["message_hash"]) : null;
  if (hash && !h) { h = hash; await sql`UPDATE war_map_claims SET message_hash = ${hash} WHERE id = ${id} AND message_hash IS NULL`; }
  if (!h) return { status: "pending" };
  const res = await fetch(`https://tonapi.io/v2/events/${h}`, { headers: { Authorization: `Bearer ${tonapiKey}` }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return { status: "pending" };
  if (!res.ok) { moneyLog("tonapi_error", { path: "tile_confirm", status: res.status }); throw new Error("confirmation_service_unavailable"); }
  const ev = (await res.json()) as TileEvidence & { event_id: string };
  const n = tileNano(Number(row["amount"]));
  const status = settledTile(ev, { ...raw, vaultNano: n.vault, marketingNano: n.marketing, comment: tileComment(id), createdAt });
  if (status !== "confirmed") {
    if (status === "failed") { moneyLog("settlement_mismatch", { path: "tile_confirm" }); await sql`UPDATE war_map_claims SET status = 'failed' WHERE id = ${id} AND status = 'pending'`; }
    return { status };
  }
  const upd = await sql`UPDATE war_map_claims SET status = 'confirmed', event_id = ${ev.event_id} WHERE id = ${id} AND status = 'pending' RETURNING id`;
  if (!upd.rows.length) return { status: "confirmed" };
  await sql`INSERT INTO war_map_tiles (idx, faction, price) VALUES (${Number(row["idx"])}, ${String(row["faction"])}, ${Number(row["amount"])})
    ON CONFLICT (idx) DO UPDATE SET faction = EXCLUDED.faction, price = GREATEST(war_map_tiles.price, EXCLUDED.price), updated_at = NOW()`;
  return { status: "confirmed" };
}

/** Total GRAM routed to the War Vault by map claims. */
export async function mapVaultGram() {
  await ensureWarMapSchema();
  const r = await sql`SELECT COALESCE(SUM(amount), 0)::float8 AS s FROM war_map_claims WHERE status = 'confirmed'`;
  return Math.round(Number(r.rows[0]?.["s"] ?? 0) * 0.6 * 100) / 100;
}
