import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { WarMap } from "@/components/warmap/WarMap";

export const Route = createFileRoute("/war-map")({
  head: () => ({
    meta: [
      { title: "Tactical War Map — Meme Mayhem" },
      { name: "description", content: "Claim sectors for your meme faction on a 100×100 war map and boost your Doomsday payout." },
      { property: "og:title", content: "Tactical War Map — Meme Mayhem" },
      { property: "og:description", content: "Pixel territory warfare between meme coin factions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-2 bg-background p-2 text-foreground">
      <header className="flex items-center justify-between">
        <Link to="/" className="hud-chip"><ArrowLeft className="h-3.5 w-3.5" />Game</Link>
        <h1 className="hud-title text-xs">WAR MAP</h1>
        <span className="w-14" />
      </header>
      <WarMap />
    </main>
  ),
});
