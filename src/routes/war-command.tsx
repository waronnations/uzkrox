// War Command terminal: one-screen, swipe-only memecoin command deck.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { WarCommandDeck } from "@/components/command/WarCommandDeck";
import { PreflightDeck } from "@/components/command/PreflightDeck";

export const Route = createFileRoute("/war-command")({
  head: () => ({
    meta: [
      { title: "War Command — Memecoin Command Deck | War On Memes" },
      { name: "description", content: "Swipe through AI meme agents, the token battlefield, a live war log and apex conflicts — one-handed, in Telegram." },
      { property: "og:title", content: "War Command — Memecoin Command Deck" },
      { property: "og:description", content: "Meme agents, territory control, live war log and apex survivors in one swipeable terminal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WarCommand,
});

function WarCommand() {
  const navigate = useNavigate();
  return (
    <main className="flex h-[100dvh] flex-col gap-2 overflow-hidden bg-background p-2 text-foreground" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
      <header className="flex shrink-0 items-center justify-between">
        <Link to="/" className="hud-chip"><ArrowLeft className="h-3.5 w-3.5" />Game</Link>
        <h1 className="hud-title text-xs">WAR COMMAND</h1>
        <span className="w-14" />
      </header>
      <PreflightDeck />
      <WarCommandDeck fill onJump={() => navigate({ to: "/" })} />
    </main>
  );
}
