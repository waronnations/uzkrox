// Tactical War Map: 100×100 sectors held on the server. Claims are paid in GRAM
// (60% War Vault, 40% marketing) and only count once confirmed on-chain.
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { MAP_SIZE, tileCost, splitMapFee, citadelMultiplier } from "@/lib/syndicate/rules";
import { MAP_FACTIONS } from "@/lib/warmap/tiles";
import { prepareTileFn, confirmTileFn } from "@/lib/warmap.functions";
import { useWarMap } from "@/hooks/use-war-map";

type Faction = (typeof MAP_FACTIONS)[number];
const HUE: Record<string, number> = { DOGS: 30, NOT: 200, PEPE: 120, CAT: 300, SNOOP: 0 };

export function CitadelBar({ shares }: { shares: Record<string, number> }) {
  return (
    <div className="holo-panel p-2" aria-label="Citadel Dominance">
      <div className="hud-label mb-1">Citadel Dominance</div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {MAP_FACTIONS.map((f) => <div key={f} style={{ width: `${(shares[f] ?? 0) * 100}%`, background: `hsl(${HUE[f]} 80% 50%)` }} />)}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1 text-center">
        {MAP_FACTIONS.map((f) => {
          const m = citadelMultiplier(shares[f] ?? 0);
          return <div key={f}><div className="hud-label">${f}</div><div className="font-mono text-xs">{((shares[f] ?? 0) * 100).toFixed(2)}%</div><div className={`text-[10px] ${m > 1 ? "text-neon-green" : "text-muted-foreground"}`}>{m > 1 ? `+${Math.round((m - 1) * 100)}%` : "—"}</div></div>;
        })}
      </div>
    </div>
  );
}

export function WarMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { tiles, shares, refresh, loading } = useWarMap();
  const wallet = useTonWallet();
  const [ui] = useTonConnectUI();
  const prepare = useServerFn(prepareTileFn);
  const confirm = useServerFn(confirmTileFn);
  const [faction, setFaction] = useState<Faction>("DOGS");
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const owner = wallet?.account?.address;

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext("2d"); if (!g) return;
    const s = c.width / MAP_SIZE;
    g.fillStyle = getComputedStyle(c).getPropertyValue("--color-muted") || "#222";
    g.fillRect(0, 0, c.width, c.height);
    for (const [i, t] of Object.entries(tiles)) {
      const n = Number(i);
      g.fillStyle = `hsl(${HUE[t.faction] ?? 60} 80% 50%)`;
      g.fillRect((n % MAP_SIZE) * s, Math.floor(n / MAP_SIZE) * s, s, s);
    }
    if (pick !== null) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect((pick % MAP_SIZE) * s, Math.floor(pick / MAP_SIZE) * s, s, s); }
  }, [tiles, pick]);

  const onTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(MAP_SIZE - 1, Math.floor(((e.clientX - r.left) / r.width) * MAP_SIZE));
    const y = Math.min(MAP_SIZE - 1, Math.floor(((e.clientY - r.top) / r.height) * MAP_SIZE));
    setPick(y * MAP_SIZE + x);
  };
  const cur = pick !== null ? tiles[pick] : null;
  const cost = tileCost(cur);
  const fee = splitMapFee(cost);

  async function claim() {
    if (pick === null) return;
    if (!owner) return void ui.openModal();
    setBusy("Preparing…");
    try {
      const p = await prepare({ data: { owner, idx: pick, faction } });
      if (!p.ok) throw new Error(p.error);
      await import("@/lib/onchain/buffer-polyfill");
      const { tileMessages } = await import("@/lib/warmap/tile-tx");
      setBusy("Confirm in your wallet…");
      const res = await ui.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: tileMessages({ vault: p.vault, marketing: p.marketing, vaultNano: p.vaultNano, marketingNano: p.marketingNano, comment: p.comment }) });
      setBusy("Checking the payment on-chain…");
      let boc: string | null = res.boc;
      for (let i = 0; i < 20; i++) {
        const r = await confirm({ data: { id: p.id, owner, boc } });
        boc = null;
        if (r.status === "confirmed") { toast.success(`Sector claimed for $${faction}`); refresh(); return setPick(null); }
        if (r.status === "failed") throw new Error("Payment didn't match — sector not claimed");
        await new Promise((ok) => setTimeout(ok, 4000));
      }
      toast.message("Still confirming — the sector appears once the payment lands");
      setPick(null);
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      toast.error(/reject|cancel/i.test(m) ? "Payment cancelled" : m || "Claim failed");
    } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col gap-2">
      <CitadelBar shares={shares} />
      <div className="hud-segment flex gap-1">
        {MAP_FACTIONS.map((f) => (
          <button key={f} type="button" onClick={() => setFaction(f)} className={`hud-chip flex-1 justify-center ${f === faction ? "ring-1 ring-primary" : "opacity-70"}`}>${f}</button>
        ))}
      </div>
      <canvas ref={ref} width={600} height={600} onClick={onTap} className={`hud-card aspect-square w-full touch-none ${loading ? "skeleton-shimmer" : ""}`} aria-label="War Map grid" />
      <p className="text-[10px] text-muted-foreground">Claims are paid in GRAM from your wallet and confirmed on-chain. Holding 15%+ of the map gives a +10% to +30% Doomsday weight bonus.</p>
      <TacticalModal open={pick !== null} onClose={() => !busy && setPick(null)} title={pick !== null ? `Sector ${pick % MAP_SIZE},${Math.floor(pick / MAP_SIZE)}` : undefined} subtitle={cur ? `Held by $${cur.faction}` : "Unclaimed"}>
        <div className="flex flex-col gap-2 text-xs">
          <div className="hud-card flex justify-between p-2"><span>Cost</span><b>{cost} GRAM</b></div>
          <div className="hud-card flex justify-between p-2"><span>To War Vault (60%)</span><span>{fee.vault}</span></div>
          <div className="hud-card flex justify-between p-2"><span>To marketing (40%)</span><span>{fee.marketing}</span></div>
          {cur && <p className="text-muted-foreground">Taking an enemy sector costs 1.5× its last price.</p>}
          {cur?.faction === faction && <p className="text-neon-amber">Your faction already holds this sector.</p>}
          <button type="button" disabled={!!busy || cur?.faction === faction} onClick={claim} className="cta-amber flex items-center justify-center gap-1.5 py-2 font-black uppercase">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{busy}</> : owner ? `Claim for $${faction} · ${cost} GRAM` : "Connect wallet"}
          </button>
        </div>
      </TacticalModal>
    </div>
  );
}
