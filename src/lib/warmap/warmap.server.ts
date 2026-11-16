// War Map server: tile ownership + paid claims verified on TonAPI before a tile changes hands.
import { sql } from "@/lib/db/client.server";
import { tileCost, MAP_SIZE } from "@/lib/syndicate/rules";
import { settledTile, tileComment, tileNano, TILE_TTL_MS, type TileEvidence } from "./tiles";

let ready: Promise<void> | null = null;
export function ensureWarMapSchema() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS war_map_tiles (idx INT PRIMARY KEY, faction TEXT NOT NULL, price DOUBLE PRECISION NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS war_map_claims (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, owner TEXT NOT NULL, idx INT NOT NULL, faction TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL, status TEXT NOT NULL DEFAULT 'pending', message_hash TEXT, event_id TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/** Public map: tile index → faction + last price. No owners. */
export async function warMapTiles() {
  await ensureWarMapSchema();
  const r = await sql`SELECT idx, faction, price FROM war_map_tiles`;
  return r.rows.map((x) => [Number(x["idx"]), String(x["faction"]), Number(x["price"])] as [number, string, number]);
}

export async function prepareTile(userId: string | number, owner: string, idx: number, faction: string) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= MAP_SIZE * MAP_SIZE) throw new Error("bad_tile");
  await ensureWarMapSchema();
  const cur = (await sql`SELECT faction, price FROM war_map_tiles WHERE idx = ${idx}`).rows[0];
  if (cur && String(cur["faction"]) === faction) throw new Error("Your faction already holds this sector");
  const cost = tileCost(cur ? { faction: String(cur["faction"]), price: Number(cur["price"]) } : null);
  const id = crypto.randomUUID().replace(/-/g, "");
  await sql`INSERT INTO war_map_claims (id, user_id, owner, idx, faction, amount) VALUES (${id}, ${String(userId)}, ${owner}, ${idx}, ${faction}, ${cost})`;
  const n = tileNano(cost);
  return { id, cost, comment: tileComment(id), vaultNano: n.vault.toString(), marketingNano: n.marketing.toString() };
}

export async function confirmTile(userId: string | number, id: string, hash: string | null, raw: { owner: string; vault: string; marketing: string }) {
  await ensureWarMapSchema();
  const row = (await sql`SELECT * FROM war_map_claims WHERE id = ${id} AND user_id = ${String(userId)}`).rows[0];
  if (!row) throw new Error("claim_not_found");
  if (row["status"] === "confirmed") return { status: "confirmed" as const };
  const createdAt = new Date(String(row["created_at"])).getTime();
  if (Date.now() > createdAt + TILE_TTL_MS + 5 * 60_000) return { status: "failed" as const };
  let h = row["message_hash"] ? String(row["message_hash"]) : null;
  if (hash && !h) { h = hash; await sql`UPDATE war_map_claims SET message_hash = ${hash} WHERE id = ${id} AND message_hash IS NULL`; }
  if (!h) return { status: "pending" as const };
  const key = process.env.TONAPI_KEY;
  const res = await fetch(`https://tonapi.io/v2/events/${h}`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return { status: "pending" as const };
  if (!res.ok) throw new Error("confirmation_service_unavailable");
  const ev = (await res.json()) as TileEvidence & { event_id: string };
  const n = tileNano(Number(row["amount"]));
  const status = settledTile(ev, { ...raw, vaultNano: n.vault, marketingNano: n.marketing, comment: tileComment(id), createdAt });
  if (status !== "confirmed") {
    if (status === "failed") await sql`UPDATE war_map_claims SET status = 'failed' WHERE id = ${id}`;
    return { status };
  }
  await sql`UPDATE war_map_claims SET status = 'confirmed', event_id = ${ev.event_id} WHERE id = ${id} AND status <> 'confirmed'`;
  // Last confirmed claim takes the sector; the price never drops.
  await sql`INSERT INTO war_map_tiles (idx, faction, price) VALUES (${Number(row["idx"])}, ${String(row["faction"])}, ${Number(row["amount"])})
    ON CONFLICT (idx) DO UPDATE SET faction = EXCLUDED.faction, price = GREATEST(war_map_tiles.price, EXCLUDED.price), updated_at = NOW()`;
  return { status: "confirmed" as const };
}

/** Total GRAM routed to the War Vault by map claims. */
export async function mapVaultGram() {
  await ensureWarMapSchema();
  const r = await sql`SELECT COALESCE(SUM(amount), 0)::float8 AS s FROM war_map_claims WHERE status = 'confirmed'`;
  return Math.round(Number(r.rows[0]?.["s"] ?? 0) * 0.6 * 100) / 100;
}
