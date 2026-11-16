// Weekly Cull: bottom 5 non-promoted arena coins are eliminated at Sunday 00:00 UTC unless saved.
import { useEffect, useMemo, useState } from "react";
import { Skull } from "lucide-react";
import { useWarRoom } from "@/hooks/use-war-room";
import { CoinLogo } from "@/components/memewar/CoinLogo";
import { PromoteModal, type PromoCoin } from "./PromoteModal";
import { countdown, cullRoster, nextSundayUtc } from "@/lib/syndicate/hud";
import { hapticSelect } from "@/lib/telegram";

export function CullBoard() {
  const { data, refresh } = useWarRoom();
  const [now, setNow] = useState<number | null>(null);
  const [promo, setPromo] = useState<PromoCoin | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const roster = useMemo(() => cullRoster(data?.arena ?? []), [data]);
  if (!roster.length || now === null) return null;
  return (
    <section className="hud-card p-2" aria-label="Weekly Cull">
      <div className="mb-1 flex items-center justify-between">
        <span className="hud-title flex items-center gap-1 text-xs"><Skull className="h-3.5 w-3.5 text-destructive" />Weekly Cull</span>
        <span className="font-mono text-[10px] tabular-nums text-destructive">{countdown(nextSundayUtc(now) - now)}</span>
      </div>
      <ul className="space-y-1">
        {roster.map((c) => (
          <li key={c.master} className="flex items-center gap-1.5">
            <CoinLogo image={c.image} master={c.master} symbol={c.symbol} className="h-5 w-5 rounded-full" />
            <span className="flex-1 truncate text-[11px] font-black">{c.symbol} <span className="text-muted-foreground">#{c.rank}</span></span>
            <button type="button" onClick={() => { hapticSelect(); setPromo(c); }} className="cta-amber px-2 py-1 text-[10px] font-black uppercase">Save Coin (50 USD₮)</button>
          </li>
        ))}
      </ul>
      <PromoteModal coin={promo} onClose={() => setPromo(null)} onPaid={refresh} />
    </section>
  );
}
