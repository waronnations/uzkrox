// Promoted arena slots: 50 USD₮ via TonConnect, verified on-chain before granting.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const addr = z.string().min(40).max(70).regex(/^[A-Za-z0-9_\-:]+$/);

const toCode = (e: unknown) => {
  const m = e instanceof Error ? e.message : "promotion_failed";
  return m.startsWith("config_incomplete") ? "config_incomplete" : m;
};

/** Slots are granted only by confirmPromo after settledPromo matches the TonAPI event. */
export const preparePromoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ owner: addr, master: addr, symbol: z.string().min(1).max(16) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const { assertRateLimitShared } = await import("@/lib/rate-limit.server");
    const { hasDatabase } = await import("@/lib/db.server");
    const { requireMoney, moneyLog } = await import("@/lib/money/config.server");
    if (!hasDatabase()) return { ok: false as const, error: "storage_unavailable" };
    const uid = await requireUserId();
    try {
      const cfg = requireMoney("promo_prepare");
      await assertRateLimitShared(`promo:${uid}`, 5, 60_000);
      const { preparePromo } = await import("@/lib/arena/arena.server");
      return { ok: true as const, ...(await preparePromo(uid, data.owner, { master: data.master, symbol: data.symbol }, cfg.claimTreasury)) };
    } catch (e) {
      const error = toCode(e);
      moneyLog("promo_prepare_failed", { error });
      return { ok: false as const, error };
    }
  });

export const confirmPromoFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().regex(/^[a-f0-9]{32}$/), owner: addr, boc: z.string().max(4000).nullable() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/auth.server");
    const uid = await requireUserId();
    const { requireMoney, moneyLog } = await import("@/lib/money/config.server");
    const { assertRateLimitShared } = await import("@/lib/rate-limit.server");
    try {
      const cfg = requireMoney("promo_confirm");
      await assertRateLimitShared(`promoconf:${uid}`, 40, 60_000);
      await import("@/lib/onchain/buffer-polyfill");
      const { Address, Cell, beginCell, loadMessage } = await import("@ton/core");
      const { USDT_MASTER } = await import("@/lib/arena/promo");
      const owner = Address.parse(data.owner);
      let hash: string | null = null;
      if (data.boc) {
        const m = loadMessage(Cell.fromBase64(data.boc).beginParse());
        if (m.info.type !== "external-in" || !m.info.dest.equals(owner)) throw new Error("wallet_message_mismatch");
        hash = beginCell().storeUint(2, 2).storeUint(0, 2).storeAddress(m.info.dest).storeCoins(0).storeBit(false).storeBit(true).storeRef(m.body).endCell().hash().toString("hex");
      }
      const { confirmPromo } = await import("@/lib/arena/arena.server");
      const r = await confirmPromo(uid, data.id, hash, { owner: owner.toRawString(), treasury: Address.parse(cfg.claimTreasury).toRawString(), usdt: Address.parse(USDT_MASTER).toRawString() }, cfg.tonapiKey);
      return { ok: true as const, ...r };
    } catch (e) {
      const error = toCode(e);
      moneyLog("promo_confirm_failed", { error });
      return { ok: false as const, status: "error" as const, error };
    }
  });
