// Recon report: inline (never a pop-up) summary of live territory shifts since the last visit.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MAP_FACTIONS } from "@/lib/warmap/tiles";

const KEY = "warmap:lastShares";

export function ReconReport({ shares, ready }: { shares: Record<string, number>; ready: boolean }) {
  const [shifts, setShifts] = useState<{ f: string; d: number }[]>([]);
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    try {
      const prev = JSON.parse(localStorage.getItem(KEY) ?? "null") as Record<string, number> | null;
      if (prev) {
        setShifts(MAP_FACTIONS.map((f) => ({ f, d: (shares[f] ?? 0) - (prev[f] ?? 0) })).filter((x) => Math.abs(x.d) >= 0.0001).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3));
      }
      localStorage.setItem(KEY, JSON.stringify(shares));
    } catch { /* storage unavailable */ }
  }, [ready, shares]);
  if (!shifts.length) return null;
  return (
    <div className="hud-card flex items-start gap-2 p-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="hud-label">Recon report · since your last visit</div>
        <div className="mt-1 flex flex-wrap gap-2 font-mono">
          {shifts.map(({ f, d }) => <span key={f} className={d > 0 ? "text-neon-green" : "text-destructive"}>${f} {d > 0 ? "+" : ""}{(d * 100).toFixed(2)}%</span>)}
        </div>
      </div>
      <button type="button" onClick={() => setShifts([])} aria-label="Dismiss recon report" className="shrink-0 text-muted-foreground"><X className="h-4 w-4" /></button>
    </div>
  );
}
