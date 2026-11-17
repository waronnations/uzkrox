// 50 USD₮ promoted slot: the founder signs one USD₮ transfer to the War Vault
// via TonConnect; the server checks it on-chain before the slot is granted.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { moneyErrorText } from "@/lib/money/errors";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { CoinLogo } from "@/components/memewar/CoinLogo";
import { preparePromoFn, confirmPromoFn } from "@/lib/arena.functions";
import { PROMO_DAYS, PROMO_GAS_TON } from "@/lib/arena/promo";
import { PROMO_MIN_USDT } from "@/lib/arena/roster";

export type PromoCoin = { master: string; symbol: string; image: string | null };

export function PromoteModal({ coin, onClose, onPaid }: { coin: PromoCoin | null; onClose: () => void; onPaid?: () => void }) {
  const wallet = useTonWallet();
  const [ui] = useTonConnectUI();
  const prepare = useServerFn(preparePromoFn);
  const confirm = useServerFn(confirmPromoFn);
  const [busy, setBusy] = useState<string | null>(null);
  const owner = wallet?.account?.address;

  async function pay() {
    if (!coin) return;
    if (!owner) return void ui.openModal();
    setBusy("Preparing…");
    try {
      const p = await prepare({ data: { owner, master: coin.master, symbol: coin.symbol } });
      if (!p.ok) throw new Error(moneyErrorText(p.error));
      await import("@/lib/onchain/buffer-polyfill");
      const { toNano } = await import("@ton/core");
      const { resolveUserJettonWallet, buildJettonTransferBodySafe } = await import("@/lib/onchain/topup-tx");
      const jw = await resolveUserJettonWallet(owner, p.usdtMaster);
      const body = buildJettonTransferBodySafe({ amountNano: BigInt(p.units), destination: p.treasury, responseDestination: owner, forwardTon: 1n, comment: p.comment });
      const bytes = new Uint8Array(body.toBoc());
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      setBusy("Confirm in your wallet…");
      const res = await ui.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: [{ address: jw, amount: toNano(PROMO_GAS_TON).toString(), payload: btoa(bin) }] });
      setBusy("Checking the payment on-chain…");
      let boc: string | null = res.boc;
      for (let i = 0; i < 20; i++) {
        const r = await confirm({ data: { id: p.id, owner, boc } });
        boc = null;
        if (!r.ok) throw new Error(moneyErrorText(r.error));
        if (r.status === "confirmed") {
          toast.success(`${coin.symbol} is promoted for ${PROMO_DAYS} days`);
          onPaid?.();
          return onClose();
        }
        if (r.status === "failed") throw new Error("Payment didn't match — no slot granted");
        await new Promise((ok) => setTimeout(ok, 4000));
      }
      toast.message("Still confirming — your slot appears once the payment lands");
      onClose();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      toast.error(/reject|cancel/i.test(m) ? "Payment cancelled" : m || "Promotion failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <TacticalModal open={!!coin} onClose={() => !busy && onClose()} title={coin ? `Promote ${coin.symbol}` : undefined} subtitle="Promoted arena slot" tone="amber"
      icon={coin ? <CoinLogo image={coin.image} master={coin.master} symbol={coin.symbol} className="h-12 w-12 rounded-full" /> : <Megaphone className="h-6 w-6" />}
      footer={
        <button type="button" disabled={!!busy} onClick={pay} className="cta-amber flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-black uppercase">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{busy}</> : owner ? `Pay ${PROMO_MIN_USDT} USD₮` : "Connect wallet"}
        </button>
      }>
      <ul className="space-y-1.5 text-[12px]">
        <li className="hud-card p-2">Locks a top slot for <b>{PROMO_DAYS} days</b> and clears the Death Clock. Paying again adds {PROMO_DAYS} more days.</li>
        <li className="hud-card p-2">The full <b>{PROMO_MIN_USDT} USD₮</b> goes into the Doomsday War Vault.</li>
        <li className="hud-card p-2 text-muted-foreground">Your wallet also needs about {PROMO_GAS_TON} TON for network fees.</li>
      </ul>
    </TacticalModal>
  );
}
