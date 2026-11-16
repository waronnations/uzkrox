// Tactical War Map: 100×100 sectors. Claims are practice-only (saved on this
// device) until on-chain tile payments are wired.
import { useEffect, useMemo, useRef, useState } from "react";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { MAP_SIZE, tileCost, splitMapFee, mapShares, citadelMultiplier, type Tile } from "@/lib/syndicate/rules";

const FACTIONS = ["DOGS", "NOT", "PEPE", "CAT", "SNOOP"];
const HUE: Record<string, number> = { DOGS: 30, NOT: 200, PEPE: 120, CAT: 300, SNOOP: 0 };
const KEY = "warmap:tiles:v1";

export function WarMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tiles, setTiles] = useState<Record<number, Tile>>({});
  const [faction, setFaction] = useState("DOGS");
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => { try { setTiles(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { /* fresh */ } }, []);
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
  }, [tiles]);
  const shares = useMemo(() => mapShares(tiles), [tiles]);
  const onTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * MAP_SIZE);
    const y = Math.floor(((e.clientY - r.top) / r.height) * MAP_SIZE);
    setPick(y * MAP_SIZE + x);
  };
  const cur = pick !== null ? tiles[pick] : null;
  const cost = tileCost(cur);
  const fee = splitMapFee(cost);
  const claim = () => {
    if (pick === null) return;
    const next = { ...tiles, [pick]: { faction, price: cost } };
    setTiles(next); localStorage.setItem(KEY, JSON.stringify(next)); setPick(null);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="hud-segment flex gap-1">
        {FACTIONS.map((f) => (
          <button key={f} type="button" onClick={() => setFaction(f)} className={`hud-chip flex-1 justify-center ${f === faction ? "ring-1 ring-primary" : "opacity-70"}`}>${f}</button>
        ))}
      </div>
      <canvas ref={ref} width={600} height={600} onClick={onTap} className="hud-card aspect-square w-full touch-none" aria-label="War Map grid" />
      <div className="holo-panel grid grid-cols-5 gap-1 p-2 text-center">
        {FACTIONS.map((f) => (
          <div key={f}><div className="hud-label">${f}</div><div className="font-mono text-xs">{((shares[f] ?? 0) * 100).toFixed(2)}%</div><div className="text-[10px] text-muted-foreground">×{citadelMultiplier(shares[f] ?? 0)}</div></div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Practice mode: claims are saved on this device only. Holding 15%+ of the map gives a +10% to +30% Doomsday weight bonus.</p>
      <TacticalModal open={pick !== null} onClose={() => setPick(null)} title={pick !== null ? `Sector ${pick % MAP_SIZE},${Math.floor(pick / MAP_SIZE)}` : undefined} subtitle={cur ? `Held by $${cur.faction}` : "Unclaimed"}>
        <div className="flex flex-col gap-2 text-xs">
          <div className="hud-card flex justify-between p-2"><span>Cost</span><b>{cost} GRAM</b></div>
          <div className="hud-card flex justify-between p-2"><span>To War Vault (60%)</span><span>{fee.vault}</span></div>
          <div className="hud-card flex justify-between p-2"><span>To marketing (40%)</span><span>{fee.marketing}</span></div>
          {cur && <p className="text-muted-foreground">Taking an enemy sector costs 1.5× its last price.</p>}
          <button type="button" onClick={claim} className="cta-amber py-2 font-black uppercase">Claim for ${faction} (practice)</button>
        </div>
      </TacticalModal>
    </div>
  );
}
