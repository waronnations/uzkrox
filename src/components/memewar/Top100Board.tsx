// Top-100 Coin Board: every live TON memecoin ranked by 24h volume, grouped
// Apex #1–10 → Frontline #11–95 → Death Row #96–100, with filter tabs.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Skull, Swords, Shield } from "lucide-react";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { getTop100Fn } from "@/lib/memewar/memewar.functions";
import type { TopCoin, TopTier } from "@/lib/memewar/top100";
import { countdown, nextSundayUtc } from "@/lib/syndicate/hud";
import { CachedTokenImage } from "@/components/ui/CachedTokenImage";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

type Filter = "all" | "mine" | "apex" | "cull";
const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);
const TIERS: { id: TopTier; label: string; icon: typeof Crown; tone: string }[] = [
  { id: "apex", label: "Apex Titans · #1–10", icon: Crown, tone: "text-neon-cyan" },
  { id: "frontline", label: "Frontline · #11–95", icon: Swords, tone: "text-foreground" },
  { id: "deathrow", label: "Death Row · #96–100", icon: Skull, tone: "text-destructive" },
];

export function Top100Board({ owned, onPick }: { owned: Set<string>; onPick?: (c: TopCoin) => void }) {
  const get = useServerFn(getTop100Fn);
  const { data, loading } = useCachedQuery("board:top100", 10 * 60_000, () => get(), { refreshMs: 5 * 60_000 });
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const coins = data?.coins ?? [];
  const shown = useMemo(() => coins.filter((c) =>
    filter === "all" ? true : filter === "mine" ? owned.has(c.master) : filter === "apex" ? c.tier === "apex" : c.tier === "deathrow"), [coins, filter, owned]);

  const tabs: [Filter, string][] = [["all", `All ${coins.length || 100}`], ["mine", `My troops · ${coins.filter((c) => owned.has(c.master)).length}`], ["apex", "Apex 10"], ["cull", "Death Row 5"]];

  return (
    <section className="holo-panel mt-5 p-3" aria-label="Top 100 coin board">
      <h2 className="hud-title mb-1">Top 100 Battleground</h2>
      <p className="mb-3 text-[11px] text-muted-foreground">Ranked live by 24h traded volume on TON. The bottom 5 face the cull Sunday 00:00 UTC.</p>
      <div className="hud-segment mb-3 grid grid-cols-4 gap-1">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" onClick={() => { haptic("light"); setFilter(id); }}
            className={cn("min-h-11 rounded-md px-1 text-[10px] font-black uppercase leading-tight", filter === id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {loading && !data && <div className="grid grid-cols-4 gap-2">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="hud-card aspect-square animate-pulse" />)}</div>}
      {data?.error && coins.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Market feed is offline. Try again in a minute.</p>}
      {data && shown.length === 0 && coins.length > 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">{filter === "mine" ? "None of your coins are in the Top 100 yet. Connect a wallet or deploy troops." : "Nothing here right now."}</p>
      )}

      {TIERS.map((t) => {
        const list = shown.filter((c) => c.tier === t.id);
        if (list.length === 0) return null;
        const Icon = t.icon;
        return (
          <div key={t.id} className="mb-4">
            <div className={cn("hud-label mb-2 flex items-center justify-between", t.tone)}>
              <span className="flex items-center gap-1"><Icon className="h-3.5 w-3.5" /> {t.label}</span>
              {t.id === "deathrow" && <span>Cull in {countdown(nextSundayUtc(now) - now)}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {list.map((c) => {
                const mine = owned.has(c.master);
                return (
                  <button key={c.master} type="button" onClick={() => { haptic("light"); setOpen(open === c.master ? null : c.master); onPick?.(c); }}
                    className={cn("hud-card relative flex min-w-0 flex-col items-center gap-1 p-1.5 text-center",
                      t.id === "apex" && "border-neon-cyan/60", t.id === "deathrow" && "border-destructive/70 animate-pulse", open === c.master && "ring-2 ring-primary")}>
                    <span className={cn("absolute left-1 top-1 text-[9px] font-black", t.tone)}>#{c.rank}</span>
                    {mine && <Shield className="absolute right-1 top-1 h-3 w-3 text-neon-green" aria-label="Deployed troops" />}
                    <CachedTokenImage src={c.image} master={c.master} symbol={c.symbol} className="mt-2 h-8 w-8 rounded-full" />
                    <span className="w-full truncate text-[10px] font-black uppercase">{c.symbol}</span>
                    <span className="text-[9px] text-muted-foreground">{usd(c.volume24hUsd)}</span>
                  </button>
                );
              })}
            </div>
            {list.some((c) => c.master === open) && (() => {
              const c = list.find((x) => x.master === open)!;
              const mine = owned.has(c.master);
              return (
                <div className="hud-card mt-2 grid grid-cols-3 gap-2 p-3 text-center text-[11px]">
                  <div><div className="hud-label">24h volume</div><b>{usd(c.volume24hUsd)}</b></div>
                  <div><div className="hud-label">Liquidity</div><b>{usd(c.liquidityUsd)}</b></div>
                  <div><div className="hud-label">Price</div><b>{c.priceUsd < 0.01 ? c.priceUsd.toPrecision(2) : c.priceUsd.toFixed(3)}</b></div>
                  <p className="col-span-3 text-muted-foreground">
                    {mine ? "Deployed troops — tap it in your army above to battle." : "Not in your army. Deploy troops with Quick Swap in the Earn tab to fight for it."}
                  </p>
                </div>
              );
            })()}
          </div>
        );
      })}
    </section>
  );
}
