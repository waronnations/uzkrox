// 50 USD₮ promoted arena slots: pure rules for the payment and its on-chain proof.
import { PROMO_MIN_USDT } from "./roster";

export const USDT_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
export const USDT_DECIMALS = 6;
export const PROMO_DAYS = 7;
export const PROMO_GAS_TON = "0.06";
export const PROMO_TTL_MS = 15 * 60_000;

export const promoUnits = (usdt = PROMO_MIN_USDT) => BigInt(Math.round(usdt * 10 ** USDT_DECIMALS));
export const promoComment = (id: string) => `PROMO:${id.slice(0, 18)}`;

/** A new promotion stacks on top of any time still left on the current one. */
export function promoExpiry(now: number, currentExpiresAt: number | null) {
  return Math.max(now, currentExpiresAt ?? 0) + PROMO_DAYS * 86_400_000;
}

export type PromoEvidence = {
  timestamp: number;
  in_progress: boolean;
  is_scam?: boolean;
  actions: { type: string; status: string; JettonTransfer?: { sender?: { address: string }; recipient?: { address: string }; jetton: { address: string }; amount: string; comment?: string } }[];
};

export function settledPromo(e: PromoEvidence, x: { owner: string; treasury: string; usdtMaster: string; units: string; comment: string; createdAt: number }) {
  if (e.in_progress) return "pending" as const;
  const t = e.timestamp * 1000;
  if (e.is_scam || t < x.createdAt - 60_000 || t > x.createdAt + PROMO_TTL_MS) return "failed" as const;
  const ok = e.actions.some((a) => {
    const j = a.JettonTransfer;
    return a.type === "JettonTransfer" && a.status === "ok" && !!j && j.sender?.address === x.owner && j.recipient?.address === x.treasury
      && j.jetton.address === x.usdtMaster && /^\d+$/.test(j.amount) && BigInt(j.amount) >= BigInt(x.units) && j.comment === x.comment;
  });
  return ok ? ("confirmed" as const) : ("failed" as const);
}
