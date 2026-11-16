// Doomsday War Vault: live USD₮ pot and its 60 / 25 / 15 split (projection only).
import { Vault } from "lucide-react";
import { useWarRoom } from "@/hooks/use-war-room";
import { SPLIT } from "@/lib/apocalypse/vault-split";

const usdt = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 })} USD₮`;

export function VaultSplitCard() {
  const { data } = useWarRoom();
  const pot = data?.potUsdt ?? 0;
  const rows = [
    { label: "Bunker survivors", share: SPLIT.bunker, note: "by √value × days locked" },
    { label: "Top 3 factions", share: SPLIT.factions, note: "holders on Doomsday" },
    { label: "Top 10 players", share: SPLIT.apex, note: "apex leaderboard" },
  ];
  return (
    <section className="holo-panel p-2" aria-label="War Vault">
      <div className="flex items-center gap-1.5">
        <Vault className="h-4 w-4 text-neon-green" />
        <span className="hud-title text-[11px]">War Vault</span>
        <span className="ml-auto font-mono text-sm font-black tabular-nums text-neon-green">{usdt(pot)}</span>
      </div>
      <ul className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-8 font-mono font-bold text-neon-cyan">{Math.round(r.share * 100)}%</span>
            <span className="flex-1 truncate"><b>{r.label}</b> <span className="text-muted-foreground">· {r.note}</span></span>
            <span className="font-mono tabular-nums">{usdt(pot * r.share)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted-foreground">Projection — paid out at Doomsday from promoted-slot fees.</p>
    </section>
  );
}
