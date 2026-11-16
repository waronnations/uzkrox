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

export const prepareTileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ owner: addr, idx: z.number().int().min(0).max(9999), faction: z.enum(MAP_FACTIONS) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    const { hasDatabase } = await import("@/lib/db.server");
    if (!hasDatabase()) return { ok: false as const, error: "Saving isn't available yet" };
    const uid = await requireUserId();
    assertRateLimit(`tile:${uid}`, 10, 60_000);
    const { CLAIM_TREASURY } = await import("@/lib/onchain/contracts");
    const { MARKETING_WALLET } = await import("@/lib/syndicate/marketing");
    const { prepareTile } = await import("@/lib/warmap/warmap.server");
    try {
      return { ok: true as const, vault: CLAIM_TREASURY.address, marketing: MARKETING_WALLET, ...(await prepareTile(uid, data.owner, data.idx, data.faction)) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Claim failed" };
    }
  });

export const confirmTileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), owner: addr, boc: z.string().max(4000).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const uid = await requireUserId();
    await import("@/lib/onchain/buffer-polyfill");
    const { Address, Cell, beginCell, loadMessage } = await import("@ton/core");
    const { CLAIM_TREASURY } = await import("@/lib/onchain/contracts");
    const { MARKETING_WALLET } = await import("@/lib/syndicate/marketing");
    const owner = Address.parse(data.owner);
    let hash: string | null = null;
    if (data.boc) {
      const m = loadMessage(Cell.fromBase64(data.boc).beginParse());
      if (m.info.type !== "external-in" || !m.info.dest.equals(owner)) throw new Error("wallet_message_mismatch");
      hash = beginCell().storeUint(2, 2).storeUint(0, 2).storeAddress(m.info.dest).storeCoins(0).storeBit(false).storeBit(true).storeRef(m.body).endCell().hash().toString("hex");
    }
    const { confirmTile } = await import("@/lib/warmap/warmap.server");
    return confirmTile(uid, data.id, hash, { owner: owner.toRawString(), vault: Address.parse(CLAIM_TREASURY.address).toRawString(), marketing: Address.parse(MARKETING_WALLET).toRawString() });
  });
