// Bear agent "Sell-The-Top": shown when a faction coin has RSI > 80 and volume ≥ 3×.
import { TrendingDown, Share2, Megaphone } from "lucide-react";
import type { PromoCoin } from "@/components/arena/PromoteModal";
import { topHarvest, projectedSkim } from "@/lib/syndicate/hud";
import { shareUrl, hapticSelect } from "@/lib/telegram";
import { REFERRAL_BOT } from "@/lib/referrals.shared";

type Sig = { master: string; symbol: string; rsi: number | null; volumeX: number; harvest: boolean };

export function HarvestBanner({ signals, onPromote }: { signals: Sig[]; onPromote: (c: PromoCoin) => void }) {
  const s = topHarvest(signals);
  if (!s) return null;
  const skim = projectedSkim(s, 100);
  return (
    <div className="hud-card border-destructive/60 p-1.5" role="alert">
      <div className="flex items-center gap-1.5">
        <TrendingDown className="h-4 w-4 shrink-0 text-destructive wc-pulse" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[11px] font-black uppercase">Syndicate harvest · {s.symbol}</div>
          <div className="font-mono text-[10px] tabular-nums text-destructive">RSI {s.rsi?.toFixed(0)} · vol {s.volumeX.toFixed(1)}× · skim {skim}₮ per 100$</div>
        </div>
        <button type="button" onClick={() => { hapticSelect(); shareUrl(`https://t.me/${REFERRAL_BOT}?startapp=raid_${s.symbol}`, `${s.symbol} is topping out — raid or defend in Meme Mayhem!`); }} className="cta-danger flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase"><Share2 className="h-3 w-3" />Raid / Defend</button>
        <button type="button" onClick={() => { hapticSelect(); onPromote({ master: s.master, symbol: s.symbol, image: null }); }} className="cta-amber flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase"><Megaphone className="h-3 w-3" />Shield</button>
      </div>
    </div>
  );
}
