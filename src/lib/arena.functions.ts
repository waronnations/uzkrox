// Promoted arena slots: 50 USD₮ via TonConnect, verified on-chain before granting.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addr = z.string().min(40).max(70).regex(/^[A-Za-z0-9_\-:]+$/);

export const preparePromoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ owner: addr, master: addr, symbol: z.string().min(1).max(16) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    const { hasDatabase } = await import("@/lib/db.server");
    if (!hasDatabase()) return { ok: false as const, error: "Saving isn't available yet" };
    const uid = await requireUserId();
    assertRateLimit(`promo:${uid}`, 5, 60_000);
    const { CLAIM_TREASURY } = await import("@/lib/onchain/contracts");
    const { preparePromo } = await import("@/lib/arena/arena.server");
    return { ok: true as const, ...(await preparePromo(uid, data.owner, { master: data.master, symbol: data.symbol }, CLAIM_TREASURY.address)) };
  });

export const confirmPromoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), owner: addr, boc: z.string().max(4000).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const uid = await requireUserId();
    const { Address, Cell, beginCell, loadMessage } = await import("@ton/core");
    const { CLAIM_TREASURY } = await import("@/lib/onchain/contracts");
    const { USDT_MASTER } = await import("@/lib/arena/promo");
    const owner = Address.parse(data.owner);
    let hash: string | null = null;
    if (data.boc) {
      const m = loadMessage(Cell.fromBase64(data.boc).beginParse());
      if (m.info.type !== "external-in" || !m.info.dest.equals(owner)) throw new Error("wallet_message_mismatch");
      hash = beginCell().storeUint(2, 2).storeUint(0, 2).storeAddress(m.info.dest).storeCoins(0).storeBit(false).storeBit(true).storeRef(m.body).endCell().hash().toString("hex");
    }
    const { confirmPromo } = await import("@/lib/arena/arena.server");
    return confirmPromo(uid, data.id, hash, { owner: owner.toRawString(), treasury: Address.parse(CLAIM_TREASURY.address).toRawString(), usdt: Address.parse(USDT_MASTER).toRawString() });
  });
