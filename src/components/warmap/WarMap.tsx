// Tactical War Map: 100×100 sectors held on the server. Claims are paid in GRAM
// (60% War Vault, 40% marketing) and only count once confirmed on-chain.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Loader2, ZoomOut, FlaskConical, Radio } from "lucide-react";
import { toast } from "sonner";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { MAP_SIZE, tileCost, splitMapFee, citadelMultiplier, mapShares, type Tile } from "@/lib/syndicate/rules";
import { BLOCK, genesisTiles, blockLabel, sectorLabel, isFrontline } from "@/lib/warmap/demo";
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
  const live = useWarMap();
  const wallet = useTonWallet();
  const [ui] = useTonConnectUI();
  const prepare = useServerFn(prepareTileFn);
  const confirm = useServerFn(confirmTileFn);
  const [faction, setFaction] = useState<Faction>("DOGS");
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [block, setBlock] = useState<[number, number] | null>(null);
  const [simOverride, setSimOverride] = useState<boolean | null>(null);
  const [simTiles, setSimTiles] = useState<Record<number, Tile>>(() => genesisTiles());
  const [sweep, setSweep] = useState(0);
  const owner = wallet?.account?.address;
  const liveEmpty = Object.keys(live.tiles).length === 0;
  const sim = simOverride ?? (liveEmpty || !owner);
  const tiles = sim ? simTiles : live.tiles;
  const shares = useMemo(() => (sim ? mapShares(simTiles) : live.shares), [sim, simTiles, live.shares]);
  const loading = !sim && live.loading;

  useEffect(() => { const t = setInterval(() => setSweep((v) => (v + 1) % 120), 50); return () => clearInterval(t); }, []);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext("2d"); if (!g) return;
    const css = getComputedStyle(c);
    const view = block ? BLOCK : MAP_SIZE;
    const ox = block ? block[0] * BLOCK : 0, oy = block ? block[1] * BLOCK : 0;
    const s = c.width / view;
    g.fillStyle = css.getPropertyValue("--color-background") || "#0b0f0c";
    g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < view; y++) for (let x = 0; x < view; x++) {
      const t = tiles[(oy + y) * MAP_SIZE + ox + x];
      if (!t) continue;
      const fort = Math.min(3, Math.round(Math.log(t.price / 10) / Math.log(1.5)));
      g.fillStyle = `hsl(${HUE[t.faction] ?? 60} 75% ${38 + fort * 6}%)`;
      g.fillRect(x * s, y * s, block ? s - 2 : s, block ? s - 2 : s);
      if (block) { g.fillStyle = "rgba(0,0,0,.55)"; g.font = "bold 11px monospace"; g.fillText(`${t.price}`, x * s + 4, y * s + s - 6); }
    }
    g.strokeStyle = "rgba(120,255,160,.18)"; g.lineWidth = 1;
    const step = block ? 1 : BLOCK;
    for (let i = 0; i <= view; i += step) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, c.height); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(c.width, i * s); g.stroke();
    }
    if (!block) {
      g.fillStyle = "rgba(200,255,210,.55)"; g.font = "bold 13px monospace";
      for (let i = 0; i < 10; i++) { g.fillText("ABCDEFGHIJ"[i], i * BLOCK * s + 4, 14); g.fillText(String(i + 1), 3, i * BLOCK * s + BLOCK * s - 4); }
    }
    const sy = (sweep / 120) * c.height;
    const grad = g.createLinearGradient(0, sy - 40, 0, sy);
    grad.addColorStop(0, "rgba(120,255,160,0)"); grad.addColorStop(1, "rgba(120,255,160,.22)");
    g.fillStyle = grad; g.fillRect(0, sy - 40, c.width, 40);
    if (pick !== null) {
      const px = (pick % MAP_SIZE) - ox, py = Math.floor(pick / MAP_SIZE) - oy;
      if (px >= 0 && py >= 0 && px < view && py < view) { g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeRect(px * s, py * s, s, s); }
    }
  }, [tiles, pick, block, sweep]);

  const onTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (!block) return setBlock([Math.min(9, Math.floor(fx * 10)), Math.min(9, Math.floor(fy * 10))]);
    const x = block[0] * BLOCK + Math.min(BLOCK - 1, Math.floor(fx * BLOCK));
    const y = block[1] * BLOCK + Math.min(BLOCK - 1, Math.floor(fy * BLOCK));
    setPick(y * MAP_SIZE + x);
  };
  const cur = pick !== null ? tiles[pick] : null;
  const cost = tileCost(cur);
  const fee = splitMapFee(cost);
  const front = pick !== null && isFrontline(tiles, pick, faction);

  async function claim() {
    if (pick === null) return;
    if (sim) {
      setSimTiles((t) => ({ ...t, [pick]: { faction, price: cost } }));
      toast.success(`Simulated: ${sectorLabel(pick)} captured for $${faction}`);
      return setPick(null);
    }
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
        if (r.status === "confirmed") { toast.success(`Sector claimed for $${faction}`); live.refresh(); return setPick(null); }
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
      <div className="hud-card flex items-center justify-between gap-2 p-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-bold uppercase">
          {sim ? <><FlaskConical className="h-3.5 w-3.5 text-neon-amber" />War simulation · no GRAM spent</> : <><Radio className="h-3.5 w-3.5 text-neon-green" />Live map · on-chain claims</>}
        </span>
        <button type="button" className="hud-chip" onClick={() => setSimOverride(!sim)}>{sim ? "Go live" : "Simulate"}</button>
      </div>
      {sim && !owner && <p className="text-[10px] text-muted-foreground">Try the map freely. Connect a wallet and switch to live to claim real sectors.</p>}
      {!sim && liveEmpty && <p className="text-[10px] text-neon-amber">No sectors claimed yet — be the first to plant your flag.</p>}
      <CitadelBar shares={shares} />
      <div className="hud-segment flex gap-1">
        {MAP_FACTIONS.map((f) => (
          <button key={f} type="button" onClick={() => setFaction(f)} className={`hud-chip flex-1 justify-center ${f === faction ? "ring-1 ring-primary" : "opacity-70"}`}>${f}</button>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="hud-label">{block ? `Zone ${blockLabel(block[0], block[1])} · tap a sector` : "Tap a zone to zoom in"}</span>
        {block && <button type="button" className="hud-chip" onClick={() => setBlock(null)}><ZoomOut className="h-3.5 w-3.5" />Full map</button>}
      </div>
      <canvas ref={ref} width={600} height={600} onClick={onTap} className={`hud-card aspect-square w-full touch-none ${loading ? "skeleton-shimmer" : ""}`} aria-label="War Map grid" />
      <p className="text-[10px] text-muted-foreground">Brighter sectors are fortified (taken more often, so pricier). Taking an enemy sector costs 1.5× its last price. Holding 15%+ of the map gives a +10% to +30% Doomsday weight bonus.</p>
      <TacticalModal open={pick !== null} onClose={() => !busy && setPick(null)} title={pick !== null ? `Sector ${sectorLabel(pick)}` : undefined} subtitle={cur ? `Held by $${cur.faction}` : "Unclaimed"}>
        <div className="flex flex-col gap-2 text-xs">
          {sim && <p className="text-neon-amber">Simulation — nothing is paid or saved.</p>}
          <div className="hud-card flex justify-between p-2"><span>Cost</span><b>{cost} GRAM</b></div>
          <div className="hud-card flex justify-between p-2"><span>To War Vault (60%)</span><span>{fee.vault}</span></div>
          <div className="hud-card flex justify-between p-2"><span>To marketing (40%)</span><span>{fee.marketing}</span></div>
          <p className={front ? "text-neon-green" : "text-muted-foreground"}>{front ? `Frontline push — borders $${faction} territory.` : `Deep strike — not touching $${faction} territory.`}</p>
          {cur && <p className="text-muted-foreground">Taking an enemy sector costs 1.5× its last price.</p>}
          {cur?.faction === faction && <p className="text-neon-amber">Your faction already holds this sector.</p>}
          <button type="button" disabled={!!busy || cur?.faction === faction} onClick={claim} className="cta-amber flex items-center justify-center gap-1.5 py-2 font-black uppercase">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{busy}</> : sim ? `Simulate claim · ${cost} GRAM` : owner ? `Claim for $${faction} · ${cost} GRAM` : "Connect wallet"}
          </button>
        </div>
      </TacticalModal>
    </div>
  );
}
