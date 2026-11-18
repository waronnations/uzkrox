// Operator pre-flight deck: shows which live-money settings are in place, without revealing values.
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getPreflight } from "@/lib/preflight/preflight.functions";
import type { PreflightCheck } from "@/lib/preflight/checks";

type Data = { checks: PreflightCheck[]; verdict: "ready" | "blocked"; at: string };
const dot: Record<PreflightCheck["state"], string> = { ok: "bg-primary", warn: "bg-accent", off: "bg-destructive" };

export function PreflightDeck() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = async () => { setBusy(true); try { setData(await getPreflight()); } catch { setData(null); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, []);
  return (
    <section className="hud-card shrink-0 p-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <span className="hud-label">PRE-FLIGHT</span>
        <span className="hud-chip">{data ? (data.verdict === "ready" ? "READY" : "STANDBY") : busy ? "…" : "OFFLINE"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {data?.checks.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${dot[c.state]}`} />{c.label}</span>
              <span className="truncate text-muted-foreground">{c.note}</span>
            </div>
          ))}
          <button type="button" onClick={load} disabled={busy} className="hud-chip mt-1"><RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />Re-check</button>
        </div>
      )}
    </section>
  );
}
