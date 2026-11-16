// Death Clock alert: arena coins at rank 95–100 (or with a promotion ending)
// have 6 hours to be rescued by raids or a 50 USD₮ promoted slot.
import { useEffect, useMemo, useState } from "react";
import { Skull, Share2, Megaphone } from "lucide-react";
import { useWarRoom } from "@/hooks/use-war-room";
import { CoinLogo } from "@/components/memewar/CoinLogo";
import { PromoteModal, type PromoCoin } from "./PromoteModal";
import { shareUrl, hapticSelect } from "@/lib/telegram";
import { REFERRAL_BOT } from "@/lib/referrals.shared";

const pad = (n: number) => String(n).padStart(2, "0");
const left = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };

export function DeathClockBanner() {
  const { data, refresh } = useWarRoom();
  const [now, setNow] = useState<number | null>(null);
  const [promo, setPromo] = useState<PromoCoin | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const doomed = useMemo(() => (data?.arena ?? []).filter((e) => e.deathClockEndsAt !== null).sort((a, b) => (a.deathClockEndsAt ?? 0) - (b.deathClockEndsAt ?? 0)), [data]);
  if (!doomed.length || now === null) return null;
  const first = doomed[0];
  const raid = (s: string) => shareUrl(`https://t.me/${REFERRAL_BOT}?startapp=raid_${s}`, `${s} is on the Death Clock — raid with me in Meme Mayhem!`);
  return (
    <section className="hud-card border-destructive/60 p-1.5" aria-label="Death Clock">
      <div className="flex items-center gap-1.5">
        <Skull className="h-4 w-4 shrink-0 text-destructive wc-pulse" />
        <CoinLogo image={first.image} master={first.master} symbol={first.symbol} className="h-5 w-5 rounded-full" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[11px] font-black uppercase">{first.symbol} #{first.rank} · Death Clock</div>
          <div className="font-mono text-[10px] tabular-nums text-destructive">{left((first.deathClockEndsAt ?? 0) - now)} left{doomed.length > 1 ? ` · +${doomed.length - 1} more` : ""}</div>
        </div>
        <button type="button" aria-label={`Raid ${first.symbol}`} onClick={() => { hapticSelect(); raid(first.symbol); }} className="cta-danger flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase"><Share2 className="h-3 w-3" />Raid</button>
        <button type="button" aria-label={`Promote ${first.symbol}`} onClick={() => { hapticSelect(); setPromo(first); }} className="cta-amber flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase"><Megaphone className="h-3 w-3" />50$</button>
      </div>
      <PromoteModal coin={promo} onClose={() => setPromo(null)} onPaid={refresh} />
    </section>
  );
}
