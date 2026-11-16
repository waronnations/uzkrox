// src/components/game/tabs/PlayTab.tsx
// Play tab = unified command HUD: the War Command deck on top, then one
// switchable front (Coin Board or Bunker LP) so the screen never stacks both.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutGrid, Shield } from "lucide-react";
import { MemeWarBoard } from "@/components/memewar/MemeWarBoard";
import { BunkerLpBoard } from "@/components/bunker/BunkerLpBoard";
import { WarCommandDeck, type DeckJump } from "@/components/command/WarCommandDeck";
import { DeathClockBanner } from "@/components/arena/DeathClockBanner";
import { CullBoard } from "@/components/arena/CullBoard";
import { VaultSplitCard } from "@/components/arena/VaultSplitCard";
import { hapticSelect } from "@/lib/telegram";
import { cn } from "@/lib/utils";

type Front = "board" | "bunker";

export function PlayTab({ onOpenSwap }: { onOpenSwap?: () => void }) {
  const [front, setFront] = useState<Front>("board");
  const jump = (to: DeckJump) => {
    if (to === "swap") return onOpenSwap?.();
    setFront(to);
    if (typeof document !== "undefined") document.getElementById("play-front")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const fronts: { id: Front; label: string; icon: typeof Shield }[] = [
    { id: "board", label: "Coin board", icon: LayoutGrid },
    { id: "bunker", label: "Bunker", icon: Shield },
  ];
  return (
    <div className="mx-auto w-full max-w-lg space-y-2">
      <WarCommandDeck onJump={jump} />
      <DeathClockBanner />
      <CullBoard />
      <Link to="/war-map" className="hud-chip justify-center py-1.5 text-[11px] font-black uppercase">Tactical War Map · claim sectors</Link>
      <div id="play-front" className="hud-segment scroll-mt-2 p-0.5">
        {fronts.map((f) => (
          <button key={f.id} type="button" onClick={() => { hapticSelect(); setFront(f.id); }}
            className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-black uppercase", front === f.id ? "hud-segment-active" : "text-muted-foreground")}>
            <f.icon className="h-3.5 w-3.5" />{f.label}
          </button>
        ))}
      </div>
      {front === "board" ? <MemeWarBoard embedded /> : <><VaultSplitCard /><BunkerLpBoard /></>}
    </div>
  );
}
