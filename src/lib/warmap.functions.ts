// Tactical War Map: public tile reads + paid GRAM claims verified on-chain.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAP_FACTIONS } from "@/lib/warmap/tiles";

const addr = z.string().min(40).max(70).regex(/^[A-Za-z0-9_\-:]+$/);

export const getWarMapFn = createServerFn({ method: "GET" }).handler(async () => {
  const { hasDatabase } = await import("@/lib/db.server");
  if (!hasDatabase()) return { tiles: [] as [number, string, number][], vaultGram: 0 };
  const { warMapTiles, mapVaultGram } = await import("@/lib/warmap/warmap.server");
  try {
    const [tiles, vaultGram] = await Promise.all([warMapTiles(), mapVaultGram()]);
    return { tiles, vaultGram };
  } catch (e) {
    console.error(e);
    return { tiles: [] as [number, string, number][], vaultGram: 0 };
  }
});

const toCode = (e: unknown) => {
  const m = e instanceof Error ? e.message : "claim_failed";
  return m.startsWith("config_incomplete") ? "config_incomplete" : m;
};

/** Live claim: refuses with config_incomplete / money_paths_disabled unless every money env is set. */
export const prepareTileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ owner: addr, idx: z.number().int().min(0).max(9999), faction: z.enum(MAP_FACTIONS) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const { assertRateLimitShared } = await import("@/lib/rate-limit.server");
    const { hasDatabase } = await import("@/lib/db.server");
    const { requireMoney, moneyLog } = await import("@/lib/money/config.server");
    if (!hasDatabase()) return { ok: false as const, error: "storage_unavailable" };
    const uid = await requireUserId();
    try {
      const cfg = requireMoney("tile_prepare");
      await assertRateLimitShared(`tile:${uid}`, 10, 60_000);
      const { prepareTile } = await import("@/lib/warmap/warmap.server");
      return { ok: true as const, vault: cfg.claimTreasury, marketing: cfg.marketingWallet, ...(await prepareTile(uid, data.owner, data.idx, data.faction)) };
    } catch (e) {
      const error = toCode(e);
      moneyLog("tile_prepare_failed", { error });
      return { ok: false as const, error };
    }
  });

export const confirmTileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), owner: addr, boc: z.string().max(4000).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const uid = await requireUserId();
    const { requireMoney, moneyLog } = await import("@/lib/money/config.server");
    const { assertRateLimitShared } = await import("@/lib/rate-limit.server");
    try {
      const cfg = requireMoney("tile_confirm");
      await assertRateLimitShared(`tileconf:${uid}`, 40, 60_000);
      await import("@/lib/onchain/buffer-polyfill");
      const { Address, Cell, beginCell, loadMessage } = await import("@ton/core");
      const owner = Address.parse(data.owner);
      let hash: string | null = null;
      if (data.boc) {
        const m = loadMessage(Cell.fromBase64(data.boc).beginParse());
        if (m.info.type !== "external-in" || !m.info.dest.equals(owner)) throw new Error("wallet_message_mismatch");
        hash = beginCell().storeUint(2, 2).storeUint(0, 2).storeAddress(m.info.dest).storeCoins(0).storeBit(false).storeBit(true).storeRef(m.body).endCell().hash().toString("hex");
      }
      const { confirmTile } = await import("@/lib/warmap/warmap.server");
      const r = await confirmTile(uid, data.id, hash, { owner: owner.toRawString(), vault: Address.parse(cfg.claimTreasury).toRawString(), marketing: Address.parse(cfg.marketingWallet).toRawString() }, cfg.tonapiKey);
      return { ok: true as const, ...r };
    } catch (e) {
      const error = toCode(e);
      moneyLog("tile_confirm_failed", { error });
      return { ok: false as const, status: "error" as const, error };
    }
  });
