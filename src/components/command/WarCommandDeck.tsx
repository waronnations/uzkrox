// Compact War Command deck: live radiation, Doomsday clock, faction agents,
// territory, war log and apex survivors. Shared by the game's Command view and
// the standalone /war-command page. Reads only public War Room data.
import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, ChevronDown, Share2, Flame, Radiation, Swords, Shield, ArrowLeftRight, Zap, ChevronRight, Megaphone, Fish } from "lucide-react";
import { useWarRoom } from "@/hooks/use-war-room";
import { PromoteModal, type PromoCoin } from "@/components/arena/PromoteModal";
import { hapticSelect } from "@/lib/telegram";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { CoinLogo } from "@/components/memewar/CoinLogo";
import { AGENTS, agentConfidence, isHot, radiationSeverity, sectorStatus, type Severity } from "@/lib/war-command/derive";
import { cn } from "@/lib/utils";
import { shareUrl } from "@/lib/telegram";
import { REFERRAL_BOT } from "@/lib/referrals.shared";

export type DeckJump = "board" | "bunker" | "swap";
type View = "intel" | "log" | "whales" | "apex";

const pad = (n: number) => String(n).padStart(2, "0");
const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);
const SEV: Record<Severity, string> = { info: "text-neon-cyan", warn: "text-neon-amber", crit: "text-destructive" };
const RING = { apex: "ring-neon-amber", pump: "ring-neon-green", dump: "ring-destructive" } as const;

function Logo({ symbol, image, master, status, size = "h-6 w-6" }: { symbol: string; image?: string | null; master?: string | null; status?: keyof typeof RING; size?: string }) {
  return <CoinLogo image={image ?? null} master={master} symbol={symbol} className={cn(size, "rounded-full", status && "ring-2", status && RING[status])} />;
}

export function WarCommandDeck({ onJump, fill = false }: { onJump?: (to: DeckJump) => void; fill?: boolean }) {
  const { data, refresh } = useWarRoom();
  const [promo, setPromo] = useState<PromoCoin | null>(null);
  const whales = data?.whales ?? [];
  const pot = data?.potUsdt ?? 0;
  const lastWhale = whales[0];
  const [flash, setFlash] = useState<"green" | "amber" | null>(null);
  const seenWhale = useRef<number | null>(null);
  useEffect(() => {
    if (!lastWhale) return;
    if (seenWhale.current !== null && lastWhale.at > seenWhale.current) {
      setFlash(lastWhale.tone);
      const t = setTimeout(() => setFlash(null), 2400);
      seenWhale.current = lastWhale.at;
      return () => clearTimeout(t);
    }
    seenWhale.current = lastWhale.at;
  }, [lastWhale]);
  const [now, setNow] = useState<number | null>(null);
  const [view, setView] = useState<View>("intel");
  const [pick, setPick] = useState<number | null>(null);
  const [open, setOpen] = useState(fill);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const sectors = data?.sectors ?? [];
  const rad = data?.radiation.level ?? 0;
  const sev = radiationSeverity(rad);
  const msLeft = data && now !== null ? Math.max(0, data.timer.msLeft - (now - data.generatedAt)) : null;
  const timer = msLeft === null ? "--:--:--" : (() => { const s = Math.floor(msLeft / 1000); return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; })();
  const survivors = data?.timer.survivors ?? [];
  const bySymbol = useMemo(() => new Map(sectors.map((s) => [s.symbol, s])), [sectors]);

  const agents = useMemo(() => sectors.map((s, i) => {
    const st = sectorStatus(s, sectors);
    const line = st === "apex" ? `Holding the throne` : st === "pump" ? `Pushing the front` : `Losing ground`;
    return { ...AGENTS[i % AGENTS.length], sector: s, status: st, line, conf: agentConfidence(i, s.dominance) };
  }), [sectors]);

  const log = useMemo(() => {
    const out: { sym: string; text: string; sev: Severity }[] = [{ sym: "", text: `Radiation ${rad}% — ${sev === "crit" ? "bunker now" : sev === "warn" ? "masks on" : "air is clear"}`, sev }];
    for (const k of data?.combat ?? []) out.push({ sym: "", text: `${k.attacker} ${k.hit ? "hit" : "missed"} ${k.victim} · +${k.glory} glory`, sev: k.hit ? "warn" : "info" });
    for (const s of sectors) {
      const st = sectorStatus(s, sectors);
      out.push({ sym: s.symbol, text: st === "apex" ? `${s.symbol} leads with ${(s.dominance * 100).toFixed(0)}%` : st === "pump" ? `${s.symbol} trading ${usd(s.volume24hUsd)}` : `${s.symbol} under pressure`, sev: st === "dump" ? "crit" : "info" });
    }
    return out;
  }, [data, sectors, rad, sev]);

  const sel = pick !== null ? agents[pick] : null;
  const tabs: { id: View; label: string }[] = [{ id: "intel", label: "Intel" }, { id: "log", label: "War log" }, { id: "whales", label: "Whales" }, { id: "apex", label: "Apex" }];
  const jumps: { id: DeckJump; label: string; icon: typeof Swords; cls: string }[] = [
    { id: "board", label: "Raid", icon: Swords, cls: "cta-danger" },
    { id: "bunker", label: "Bunker", icon: Shield, cls: "cta-amber" },
    { id: "swap", label: "Swap", icon: ArrowLeftRight, cls: "cta-primary" },
  ];

  return (
    <section className={cn("holo-panel flex flex-col gap-1.5 p-2 transition-shadow", fill && "min-h-0 flex-1", flash === "green" && "shadow-[0_0_24px_-4px_var(--neon-green)]", flash === "amber" && "shadow-[0_0_24px_-4px_var(--neon-amber)]")} aria-label="War Command">
      {/* Status strip */}
      <div className="flex items-center gap-2">
        <span className="hud-title text-[10px] leading-none">CMD</span>
        <Radiation className={cn("h-3.5 w-3.5 shrink-0", SEV[sev], sev !== "info" && "wc-rad")} />
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all duration-700", sev === "crit" ? "bg-destructive" : sev === "warn" ? "bg-neon-amber" : "bg-neon-cyan")} style={{ width: `${rad}%` }} />
        </div>
        <span className={cn("font-mono text-[10px] font-bold tabular-nums", SEV[sev])}>{rad}%</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{timer}</span>
        <span className="font-mono text-[10px] font-black tabular-nums text-neon-green" title="War Vault">{pot >= 1000 ? `${(pot / 1000).toFixed(1)}K` : pot.toFixed(0)}₮</span>
        <span className="h-1.5 w-1.5 rounded-full bg-neon-green wc-pulse" aria-label="Live" />
        {!fill && (
          <button type="button" aria-label={open ? "Collapse command deck" : "Expand command deck"} onClick={() => { hapticSelect(); setOpen((o) => !o); }} className="hud-chip p-0.5">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>
      {!open && <p className={cn("truncate font-mono text-[10px]", flash === "green" ? "text-neon-green" : flash === "amber" ? "text-neon-amber" : "text-muted-foreground")}>{flash && lastWhale ? `🐋 ${lastWhale.side === "buy" ? "Whale bought" : "Whale dumped"} ${usd(lastWhale.usd)} ${lastWhale.symbol}` : log[1]?.text ?? log[0]?.text}</p>}
      {open && (<>

      {/* Territory: one tile per faction, real logos */}
      <div className="grid grid-cols-4 gap-1">
        {sectors.length === 0 && Array.from({ length: 4 }).map((_, i) => <div key={i} className="hud-card skeleton-shimmer h-14" />)}
        {agents.map((a, i) => (
          <button key={a.sector.id} type="button" onClick={() => { hapticSelect(); setPick(i); }}
            className={cn("hud-card relative flex flex-col items-center gap-0.5 px-1 py-1.5", a.status === "apex" && "shadow-[0_0_18px_-6px_var(--neon-amber)]")}>
            {a.status === "apex" && <Crown className="absolute left-0.5 top-0.5 h-3 w-3 text-neon-amber" />}
            {isHot(a.sector, sectors) && <Flame className="absolute right-0.5 top-0.5 h-3 w-3 text-neon-amber" />}
            <Logo symbol={a.sector.symbol} image={a.sector.image} master={a.sector.master} status={a.status} size="h-7 w-7" />
            <span className="max-w-full truncate text-[9px] font-black leading-none">{a.sector.symbol}</span>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${a.sector.dominance * 100}%` }} /></div>
            <span className="font-mono text-[9px] tabular-nums leading-none text-muted-foreground">{(a.sector.dominance * 100).toFixed(0)}%</span>
          </button>
        ))}
      </div>

      {/* View switch */}
      <div className="hud-segment p-0.5">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => { hapticSelect(); setView(t.id); }}
            className={cn("flex-1 rounded-lg py-1 text-[10px] font-black uppercase tracking-wide", view === t.id ? "hud-segment-active" : "text-muted-foreground")}>{t.label}</button>
        ))}
      </div>

      <div className={cn("min-h-0 overflow-hidden", fill ? "flex-1" : "h-[88px]")}>
        {view === "intel" && (
          <ul className="space-y-1">
            {agents.map((a, i) => (
              <li key={a.id}>
                <button type="button" onClick={() => setPick(i)} className="flex w-full items-center gap-2 text-left text-[11px]">
                  <Logo symbol={a.sector.symbol} image={a.sector.image} master={a.sector.master} size="h-4 w-4" />
                  <span className="w-16 truncate font-bold">{a.name}</span>
                  <span className={cn("flex-1 truncate", a.status === "dump" ? "text-destructive" : a.status === "apex" ? "text-neon-amber" : "text-neon-green")}>{a.line}</span>
                  <span className="font-mono tabular-nums text-neon-cyan">{a.conf}%</span>
                </button>
              </li>
            ))}
            {agents.length === 0 && <li className="hud-label">Scouting the frontline…</li>}
          </ul>
        )}
        {view === "log" && (
          <ol className="space-y-1 font-mono text-[10px]">
            {log.slice(0, fill ? 14 : 5).map((l, i) => {
              const s = l.sym ? bySymbol.get(l.sym) : undefined;
              return (
                <li key={i} className={cn("flex items-center gap-1.5", SEV[l.sev])}>
                  {s ? <Logo symbol={s.symbol} image={s.image} master={s.master} size="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{l.text}</span>
                </li>
              );
            })}
          </ol>
        )}
        {view === "whales" && (
          <ol className="space-y-1 font-mono text-[10px]">
            {whales.length === 0 && <li className="hud-label">No trades over $5K right now.</li>}
            {whales.slice(0, fill ? 12 : 5).map((w, i) => {
              const s = bySymbol.get(w.symbol);
              return (
                <li key={`${w.at}-${i}`} className={cn("flex items-center gap-1.5", w.tone === "green" ? "text-neon-green" : "text-neon-amber")}>
                  {s ? <Logo symbol={s.symbol} image={s.image} master={s.master} size="h-3.5 w-3.5" /> : <Fish className="h-3.5 w-3.5 shrink-0" />}
                  <span className="w-9 font-black uppercase">{w.side === "buy" ? "Buy" : "Dump"}</span>
                  <span className="flex-1 truncate">{w.symbol} · {/dedust/i.test(w.venue) ? "DeDust" : "STON.fi"}</span>
                  <span className="tabular-nums">{usd(w.usd)}</span>
                </li>
              );
            })}
          </ol>
        )}
        {view === "apex" && (
          <ol className="space-y-1">
            {survivors.length === 0 && <li className="hud-label">No survivors ranked yet.</li>}
            {survivors.slice(0, fill ? 5 : 4).map((s) => (
              <li key={s.master} className="flex items-center gap-1.5 text-[11px]">
                <span className={cn("w-5 font-mono font-bold", s.rank === 1 ? "text-neon-amber" : "text-muted-foreground")}>#{s.rank}</span>
                <Logo symbol={s.symbol} image={s.image} master={s.master} size="h-4 w-4" />
                <span className="w-14 truncate font-bold">{s.symbol}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-neon-amber" style={{ width: `${s.share * 100}%` }} /></div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{s.convictionHolders}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      </>)}
      {onJump && open && (
        <div className="grid grid-cols-3 gap-1">
          {jumps.map((j) => (
            <button key={j.id} type="button" onClick={() => { hapticSelect(); onJump(j.id); }} className={cn(j.cls, "flex items-center justify-center gap-1 py-1.5 text-[10px] font-black uppercase")}>
              <j.icon className="h-3.5 w-3.5" />{j.label}
            </button>
          ))}
        </div>
      )}

      <TacticalModal open={!!sel} onClose={() => setPick(null)} title={sel ? `${sel.name} · ${sel.sector.symbol}` : undefined} subtitle={sel?.role}
        icon={sel ? <Logo symbol={sel.sector.symbol} image={sel.sector.image} master={sel.sector.master} status={sel.status} size="h-12 w-12" /> : undefined}
        footer={onJump && sel ? (
          <div className="grid grid-cols-2 gap-1.5">
          {sel.sector.master && (
            <button type="button" onClick={() => { const c = { master: sel.sector.master!, symbol: sel.sector.symbol, image: sel.sector.image ?? null }; setPick(null); setPromo(c); }} className="cta-amber col-span-2 flex items-center justify-center gap-1 py-2 text-xs font-bold">
              <Megaphone className="h-4 w-4" /> Promote slot · 50 USD₮
            </button>
          )}
          <button type="button" onClick={() => shareUrl(`https://t.me/${REFERRAL_BOT}?startapp=raid_${sel.sector.symbol}`, `Raid ${sel.sector.symbol} with me in Meme Mayhem!`)} className="cta-primary flex items-center justify-center gap-1 py-2.5 text-sm font-bold">
            <Share2 className="h-4 w-4" /> Raid squad
          </button>
          <button type="button" onClick={() => { setPick(null); onJump("board"); }} className="cta-danger flex w-full items-center justify-center gap-1 py-2.5 text-sm font-bold">
            Fight <ChevronRight className="h-4 w-4" />
          </button>
          </div>
        ) : undefined}>
        {sel && (
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="hud-card p-1.5"><div className="hud-label">Share</div><div className="font-mono text-sm font-bold">{(sel.sector.dominance * 100).toFixed(1)}%</div></div>
            <div className="hud-card p-1.5"><div className="hud-label">24h vol</div><div className="font-mono text-sm font-bold">{usd(sel.sector.volume24hUsd)}</div></div>
            <div className="hud-card p-1.5"><div className="hud-label">Liquidity</div><div className="font-mono text-sm font-bold">{usd(sel.sector.liquidityUsd)}</div></div>
          </div>
        )}
      </TacticalModal>
      <PromoteModal coin={promo} onClose={() => setPromo(null)} onPaid={refresh} />
    </section>
  );
}
