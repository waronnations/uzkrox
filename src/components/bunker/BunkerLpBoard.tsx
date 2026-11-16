// Coin board liquidity front: pool metrics, Bunker LP and the seven-day USD₮ settlement.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Droplets, Shield, ShieldCheck, Skull } from "lucide-react";
import { getLpBoardFn, getMyBunkerFn } from "@/lib/bunker.functions";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { TTL } from "@/lib/cache/metric-cache";
import { CachedTokenImage } from "@/components/ui/CachedTokenImage";
import { cn } from "@/lib/utils";
import { pledgeEligibleForSettlement, type LpBoardRow } from "@/lib/bunker/lp";
import {
  SETTLEMENT_LIQUIDATION_COST_BPS,
  SETTLEMENT_WINDOW_DAYS,
  projectBunkerSettlement,
  survivorWeight,
} from "@/lib/apocalypse/bunker-settlement";
import { BunkerLpModal } from "./BunkerLpModal";
import { fmtBps, fmtPct, fmtShare, fmtUsdShort } from "./format";

type SortKey = "tvl" | "apr" | "fees" | "bunker";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "tvl", label: "Depth" },
  { id: "apr", label: "Fee APR" },
  { id: "fees", label: "LP fees" },
  { id: "bunker", label: "Bunker" },
];
const sortValue = (r: LpBoardRow, k: SortKey) =>
  k === "tvl" ? r.metrics.tvlUsd : k === "apr" ? r.metrics.feeApr : k === "fees" ? r.metrics.lpFees24hUsd : r.metrics.bunkerUsd;

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="hud-label truncate text-[9px]">{label}</div>
      <div className={cn("truncate font-mono text-[12px] font-black text-foreground", tone)}>{value}</div>
    </div>
  );
}

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const signedUsd = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmtUsdShort(Math.abs(value))}`;

export function BunkerLpBoard() {
  const getBoard = useServerFn(getLpBoardFn);
  const getMine = useServerFn(getMyBunkerFn);
  const { data, loading, refresh } = useCachedQuery("bunker:lp-board:v2", TTL.board, () => getBoard(), { refreshMs: TTL.board });
  const { data: mine, refresh: refreshMine } = useCachedQuery("bunker:mine", TTL.routes, () => getMine());
  const [sort, setSort] = useState<SortKey>("tvl");
  const [open, setOpen] = useState<LpBoardRow | null>(null);
  const now = useNow();

  const rows = useMemo(() => [...(data?.rows ?? [])].sort((a, b) => sortValue(b, sort) - sortValue(a, sort)), [data, sort]);
  const totals = useMemo(() => {
    const r = data?.rows ?? [];
    return {
      tvl: r.reduce((s, x) => s + x.metrics.tvlUsd, 0),
      fees: r.reduce((s, x) => s + x.metrics.lpFees24hUsd, 0),
      bunker: r.reduce((s, x) => s + x.metrics.bunkerUsd, 0),
      pledgers: r.reduce((s, x) => s + x.metrics.bunkerPledgers, 0),
    };
  }, [data]);
  const myByMaster = useMemo(() => new Map((mine?.pledges ?? []).map((p) => [p.coinMaster, p])), [mine]);
  const viewerWeight = useMemo(() => {
    if (!data?.until) return 0;
    return (mine?.pledges ?? [])
      .filter((pledge) => pledgeEligibleForSettlement(pledge.status))
      .reduce((sum, pledge) => sum + survivorWeight({
        bunkedUsdt: pledge.lpUsd,
        pledgedAtMs: new Date(pledge.pledgedAt).getTime(),
      }, data.until), 0);
  }, [data?.until, mine]);
  const projection = useMemo(() => {
    if (!data || now === null || !(data.until > 0)) return null;
    return projectBunkerSettlement({
      now,
      asOf: data.updatedAt,
      doomsdayAt: data.until,
      pools: data.settlementPools ?? [],
      viewerWeight,
      totalWeight: data.totalSurvivorWeight ?? 0,
    });
  }, [data, now, viewerWeight]);

  const phase = projection?.lifecycle;
  const phaseLabel = phase?.phase === "final_claims_open"
    ? "Final claims open"
    : phase?.phase === "liquidation_window"
      ? `Liquidation · day ${phase.liquidationDay}/${SETTLEMENT_WINDOW_DAYS}`
      : "Bunker active";
  const feesPerDay = projection?.pools.reduce((sum, pool) => sum + pool.feesPerDayUsdt, 0) ?? 0;

  return (
    <section className="holo-panel space-y-3 p-4" aria-labelledby="bunker-lp-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="bunker-lp-title" className="hud-title flex items-center gap-2">
          <Droplets className="h-4 w-4 text-neon-cyan" /> Bunker liquidity
        </h3>
        <span className="hud-chip text-muted-foreground">Until Doomsday</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Supply a coin's STON.fi pool and pledge the LP until the nuke. Every unbroken pledge shares the final USD₮ pool by bunked value and holding conviction — apex status never decides your payout.
      </p>

      {projection && phase && (
        <div className="hud-card space-y-3 p-3" aria-label="Doomsday USD₮ settlement projection">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="hud-label flex items-center gap-1.5"><Coins className="h-3.5 w-3.5 text-neon-cyan" /> Doomsday USD₮ settlement</div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {phase.phase === "bunker_active" && `${projection.pools.length} pledged pool${projection.pools.length === 1 ? "" : "s"} · seven daily unwind tranches after Doomsday.`}
                {phase.phase === "liquidation_window" && `${phase.completedTranches}/${SETTLEMENT_WINDOW_DAYS} daily tranches realised · non-stable legs convert to USD₮.`}
                {phase.phase === "final_claims_open" && "All seven tranches are realised. Final USD₮ allocations are now claimable in game accounting."}
              </p>
            </div>
            <span className={cn("hud-chip shrink-0", phase.phase === "final_claims_open" ? "neon-text-green" : "neon-text-amber")}>{phaseLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Your projected cashout" value={fmtUsdShort(projection.projectedCashoutUsdt)} tone="neon-text-green" />
            <Metric label="Your survivor share" value={fmtShare(projection.viewerShare)} tone="neon-text-cyan" />
            <Metric label="Fees accrued (est.)" value={fmtUsdShort(projection.accruedFeesUsdt)} tone="neon-text-green" />
            <Metric label="Final USD₮ pool (est.)" value={fmtUsdShort(projection.finalPoolUsdt)} tone="neon-text-amber" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
              <span>USD₮ liquidation</span>
              <span>{phase.completedTranches}/{SETTLEMENT_WINDOW_DAYS} tranches</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Doomsday liquidation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(phase.progress * 100)}
            >
              <div className="progress-fill" style={{ width: `${phase.progress * 100}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
            <Metric label="Settlement value" value={fmtUsdShort(projection.settlementValueUsdt)} />
            <Metric label="Realised liq. yield" value={signedUsd(projection.realizedLiquidationYieldUsdt)} tone={projection.realizedLiquidationYieldUsdt < 0 ? "text-destructive" : "neon-text-green"} />
            <Metric label="Claimable USD₮" value={fmtUsdShort(projection.claimableUsdt)} tone={projection.claimableUsdt > 0 ? "neon-text-green" : undefined} />
          </div>

          <p className="text-[10px] text-muted-foreground">
            {viewerWeight <= 0
              ? "Sign in and hold an unbroken LP pledge to establish your survivor share."
              : `Fee run-rate ${fmtUsdShort(feesPerDay)}/day until Doomsday · projected liquidation yield ${signedUsd(projection.projectedLiquidationYieldUsdt)}.`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="Pool depth" value={fmtUsdShort(totals.tvl)} />
        <Metric label="LP fees 24h" value={fmtUsdShort(totals.fees)} tone="neon-text-green" />
        <Metric label="In bunker" value={fmtUsdShort(totals.bunker)} tone="neon-text-amber" />
        <Metric label="Pledgers" value={String(totals.pledgers)} />
      </div>

      {(mine?.pledges.length ?? 0) > 0 && (
        <div className="hud-card space-y-1.5 p-3">
          <div className="hud-label flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-neon-cyan" /> Your bunker</div>
          {mine!.pledges.map((p) => (
            <div key={p.pool} className="flex items-center gap-2 text-xs">
              <span className="flex-1 font-bold text-foreground">${p.symbol}</span>
              <span className="text-muted-foreground">{fmtUsdShort(p.valueUsd)}</span>
              <span className="neon-text-green">{fmtUsdShort(p.feesPerDayUsd)}/day</span>
              <span className={cn("hud-chip", pledgeEligibleForSettlement(p.status) ? "neon-text-green" : "text-destructive")}>{p.status}</span>
            </div>
          ))}
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> Holding, survived and fallen pledges settle; broken pledges do not.</p>
        </div>
      )}

      <div role="group" aria-label="Sort pools" className="hud-segment">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            aria-pressed={sort === s.id}
            className={cn("min-h-11 flex-1 rounded-[0.7rem] border-0 bg-transparent px-1 text-[10px] font-black uppercase tracking-wider", sort === s.id ? "hud-segment-active" : "text-muted-foreground")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <div className="progress-track"><div className="progress-fill w-1/2 animate-pulse" /></div>}
      {data?.error && <p className="text-xs text-destructive">{data.error}</p>}

      <ul className="space-y-2">
        {rows.map((r) => {
          const m = r.metrics;
          const my = myByMaster.get(r.master);
          return (
            <li key={r.master} className="hud-card space-y-2 p-3">
              <div className="flex items-center gap-2">
                <CachedTokenImage src={r.image} master={r.master} symbol={r.symbol} className="h-7 w-7 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-black text-foreground">${r.symbol}</span>
                    <span className="hud-chip text-muted-foreground">{r.tier}</span>
                    {my && <span className="hud-chip neon-text-green">pledged</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.poolCount} pool{m.poolCount === 1 ? "" : "s"} · swap fee {fmtBps(m.feeBps)} = {fmtBps(m.lpFeeBps)} to LPs + {fmtBps(m.protocolFeeBps)} protocol
                  </div>
                </div>
                <button
                  onClick={() => setOpen(r)}
                  disabled={!r.canProvide}
                  className="hit-cta cta-amber min-h-11 shrink-0 px-3 text-[11px] font-black uppercase disabled:opacity-40"
                  aria-label={`Bunker LP for ${r.symbol}`}
                >
                  {r.canProvide ? "Bunker LP" : "No pool"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Metric label="Depth" value={fmtUsdShort(m.tvlUsd)} />
                <Metric label="Vol 24h" value={fmtUsdShort(m.volume24hUsd)} />
                <Metric label="Turnover" value={`${m.turnover.toFixed(2)}×`} />
                <Metric label="To LPs" value={fmtPct(m.lpFeeShare, 0)} />
                <Metric label="LP fees 24h" value={fmtUsdShort(m.lpFees24hUsd)} tone="neon-text-green" />
                <Metric label="Protocol 24h" value={fmtUsdShort(m.protocolFees24hUsd)} />
                <Metric label="Fee APR" value={fmtPct(m.feeApr)} tone="neon-text-green" />
                <Metric label="7d APY" value={m.apy7d > 0 ? fmtPct(m.apy7d) : "—"} />
                <Metric label="In bunker" value={fmtUsdShort(m.bunkerUsd)} tone="neon-text-amber" />
                <Metric label="Bunker %" value={fmtShare(m.bunkerShare)} />
                <Metric label="Bunker/day" value={fmtUsdShort(m.bunkerFees24hUsd)} />
                <Metric label="Votes" value={String(m.bunkerPledgers)} />
              </div>
            </li>
          );
        })}
      </ul>
      {!loading && rows.length === 0 && !data?.error && <p className="text-xs text-muted-foreground">No pools to show right now.</p>}
      <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <Skull className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Projections use current LP marks (or the last verified pledge mark), the 24h fee run-rate and {(SETTLEMENT_LIQUIDATION_COST_BPS / 100).toFixed(2)}% modelled conversion cost. Actual market proceeds can differ; this HUD does not execute a redemption transaction.
        </span>
      </p>

      <BunkerLpModal
        row={open}
        onClose={() => setOpen(null)}
        onChanged={() => {
          void refresh();
          void refreshMine();
        }}
        signedIn={mine?.signedIn ?? false}
      />
    </section>
  );
}
