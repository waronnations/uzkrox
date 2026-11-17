// TON Yield Staking: verified pools from TonAPI; the player signs the deposit in their own wallet.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { getStakingPoolsFn } from "@/lib/staking.functions";
import { depositAmount, toNanoStr, NANO } from "@/lib/staking/staking";
import { survivorWeight } from "@/lib/syndicate/rules";
import { TacticalSection } from "@/components/ui/TacticalModal";

const gram = (nano: string | bigint) => Number(BigInt(nano) / NANO).toLocaleString();

export function StakingTab({ citadel = 1 }: { citadel?: number }) {
  const get = useServerFn(getStakingPoolsFn);
  const { data, loading } = useCachedQuery("staking:pools", 600_000, () => get());
  const pools = data?.pools ?? [];
  const live = data?.live ?? false;
  const wallet = useTonWallet();
  const [ui] = useTonConnectUI();
  const [sel, setSel] = useState(0);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const pool = pools[sel];
  const nano = toNanoStr(amount || "0");
  let err: string | null = null, total: bigint | null = null;
  if (pool && amount) {
    if (nano === null) err = "Enter a valid amount";
    else try { total = depositAmount(pool.kind, nano, BigInt(pool.minStake)); } catch (e) { err = (e as Error).message; }
  }
  const valueGram = nano ? Number(nano) / 1e9 : 0;
  const weight = survivorWeight(valueGram, days, citadel);

  async function stake() {
    if (!live) return;
    if (!wallet) return void ui.openModal();
    if (!pool || total === null) return;
    setBusy(true);
    try {
      await import("@/lib/onchain/buffer-polyfill");
      const { depositBody } = await import("@/lib/staking/deposit-body");
      const bytes = new Uint8Array(depositBody(pool.kind).toBoc());
      let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
      await ui.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: [{ address: pool.address, amount: total.toString(), payload: btoa(bin) }] });
      toast.success(`Stake sent to ${pool.name} — it shows once the pool confirms it`);
      setAmount("");
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      toast.error(/reject|cancel/i.test(m) ? "Staking cancelled" : m || "Staking failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {!live && <p className="hud-card p-2 text-[11px] text-muted-foreground">{data?.paused ? "Staking live path paused — setup is incomplete." : "Preview mode — survivor weight estimates only, no live deposits yet."}</p>}
      <TacticalSection label="Verified pools">
        {loading && <div className="hud-card skeleton-shimmer h-16" />}
        {!loading && !pools.length && <p className="text-[11px] text-muted-foreground">Pools are unavailable right now. Try again shortly.</p>}
        <div className="space-y-1.5">
          {pools.slice(0, 8).map((p, i) => (
            <button key={p.address} type="button" onClick={() => setSel(i)} className={`hud-card flex w-full items-center justify-between gap-2 p-2 text-left ${i === sel ? "ring-1 ring-primary" : ""}`}>
              <div className="min-w-0"><div className="truncate text-xs font-black">{p.name}</div><div className="text-[10px] text-muted-foreground">TVL {gram(p.tvl)} GRAM · min {gram(p.minStake)}</div></div>
              <span className="hud-chip text-neon-green">{p.apy.toFixed(1)}% APY</span>
            </button>
          ))}
        </div>
      </TacticalSection>
      {pool && (
        <TacticalSection label={`Stake in ${pool.name}`}>
          <div className="grid grid-cols-2 gap-2">
            <label className="hud-label">Amount (GRAM)<input className="hud-input mt-1 w-full" inputMode="decimal" placeholder={gram(pool.minStake)} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="hud-label">Hold days: {days}<input type="range" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-2 w-full" /></label>
          </div>
          {err && <p className="mt-1 text-[11px] text-destructive">{err}</p>}
          {total !== null && <p className="mt-1 text-[10px] text-muted-foreground">Wallet sends {(Number(total) / 1e9).toFixed(2)} GRAM incl. pool fee (unused part is returned).</p>}
          <div className="hud-card mt-2 flex justify-between p-2 text-xs"><span>Survivor weight boost</span><b className="font-mono">{weight.toFixed(1)}{citadel > 1 ? ` (×${citadel})` : ""}</b></div>
          <p className="mt-1 text-[10px] text-muted-foreground">√value × (1 + days/7) × citadel bonus. Estimate only — your GRAM stays in the pool, not with us.</p>
          <button type="button" disabled={!live || busy || (!!wallet && total === null)} onClick={stake} className="cta-amber mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-sm font-black uppercase">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Confirm in wallet…</> : !live ? "Estimate only" : wallet ? "Stake" : "Connect wallet"}
          </button>
        </TacticalSection>
      )}
    </div>
  );
}
