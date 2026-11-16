// TopBar Bunker CTA: opens the shelter modal with rules, a live vault projection and the coin pool picker.
import { useState } from "react";
import { Shield } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";
import { BunkerLpBoard } from "@/components/bunker/BunkerLpBoard";
import { useWarRoom } from "@/hooks/use-war-room";
import { SPLIT, conviction } from "@/lib/apocalypse/vault-split";
import { BUNKER_LP_RULES } from "@/lib/bunker/lp";
import { StakingTab } from "@/components/bunker/StakingTab";

const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

export function BunkerButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionButton
        type="button"
        title="Open the Bunker"
        onClick={() => setOpen(true)}
        className={`flex min-h-9 items-center gap-1 rounded-xl border border-neon-cyan/60 bg-neon-cyan/10 px-2 py-1 text-[0.55rem] font-black uppercase tracking-wider text-neon-cyan ${className ?? ""}`}
      >
        <Shield className="h-3 w-3" /> Bunker
      </ActionButton>
      <BunkerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function BunkerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useWarRoom();
  const pot = data?.potUsdt ?? 0;
  const [value, setValue] = useState("100");
  const [days, setDays] = useState(7);
  const daysLeft = Math.max(0, Math.ceil((new Date(BUNKER_LP_RULES.until).getTime() - Date.now()) / 86_400_000));
  const v = Math.max(0, Number(value) || 0);
  const weight = conviction({ id: "me", valueUsd: v, days });
  const [tab, setTab] = useState<"lp" | "stake">("lp");

  return (
    <TacticalModal open={open} onClose={onClose} title="Bunker" subtitle="Shelter liquidity until Doomsday" icon={<Shield className="h-5 w-5" />}>
      <div className="hud-segment mb-3 flex gap-1 p-0.5">
        <button type="button" onClick={() => setTab("lp")} className={`hud-chip flex-1 justify-center ${tab === "lp" ? "ring-1 ring-primary" : "opacity-70"}`}>Meme LP Shelter</button>
        <button type="button" onClick={() => setTab("stake")} className={`hud-chip flex-1 justify-center ${tab === "stake" ? "ring-1 ring-primary" : "opacity-70"}`}>TON Yield Staking</button>
      </div>
      {tab === "stake" ? <StakingTab /> : <div className="space-y-3">
        <TacticalSection label="How the Bunker works">
          <ul className="space-y-1.5 text-[11px] leading-snug text-muted-foreground">
            <li><b className="text-foreground">Non-custodial:</b> you add liquidity to a real STON.fi pool and sign in your own wallet. The LP tokens stay in your wallet.</li>
            <li><b className="text-foreground">Pledge until Doomsday:</b> your LP counts until the detonation{daysLeft ? ` (~${daysLeft} days left)` : ""}. Minimum {usd(BUNKER_LP_RULES.minPledgeUsd)} of LP value.</li>
            <li><b className="text-foreground">Re-checked on-chain</b> every {BUNKER_LP_RULES.recheckMs / 60_000} min — moving LP out drops your pledge.</li>
            <li><b className="text-foreground">Survivor share:</b> {Math.round(SPLIT.bunker * 100)}% of the War Vault goes to bunker survivors, split by √value × days pledged.</li>
            <li><b className="text-foreground">Risks:</b> pool prices move (impermanent loss); payouts are projections, not guarantees.</li>
          </ul>
        </TacticalSection>

        <TacticalSection label="Your projection">
          <div className="grid grid-cols-2 gap-2">
            <label className="hud-label">LP value (USD)
              <input className="hud-input mt-1 w-full" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <label className="hud-label">Days pledged: {days}
              <input type="range" min={1} max={Math.max(1, daysLeft || 30)} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-2 w-full" />
            </label>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="hud-card p-2"><div className="hud-label">Survivor weight</div><div className="font-mono text-sm font-black text-foreground">{weight.toFixed(1)}</div></div>
            <div className="hud-card p-2"><div className="hud-label">Survivor pot now</div><div className="font-mono text-sm font-black text-neon-green">{usd(pot * SPLIT.bunker)} USD₮</div></div>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Your payout = your weight ÷ all survivors' weight × survivor pot. The pot grows as arena slots are promoted.</p>
        </TacticalSection>

        <TacticalSection label="Pick a coin to shelter">
          <BunkerLpBoard />
        </TacticalSection>
      </div>}
    </TacticalModal>
  );
}
