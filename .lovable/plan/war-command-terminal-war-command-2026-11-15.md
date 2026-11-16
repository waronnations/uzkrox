# War Command Terminal (/war-command)

A new mobile-first page for the Telegram Mini App: one screen, no vertical scroll, four swipeable panels between a fixed top status bar and a fixed bottom action bar.

## Layout
```text
+--------------------------------------+
| WAR COMMAND | [RADIATION] 03:12:45 | LIVE |
+--------------------------------------+
|  < swipe >  Agents | Battlefield | Log | Conflicts
|            (snap panels, dots below)  |
+--------------------------------------+
| Chest 12.4K | Deploy Raid BUNKER Prop Council |
+--------------------------------------+
```
- Page height locked to the viewport (Telegram safe areas respected); panels scroll sideways with snap points and dot indicators; inner lists scroll sideways or clip, never vertically.

## Panels
1. **AI Agents** - sideways row of meme agent cards (Pepe, Doge, Wojak, Bonk, Popcat, Clown Pepe, Ape): big face, pulsing status light, confidence %, one-line degen activity, small token logos. Tap opens a TacticalModal with details.
2. **Battlefield** - territory grid using token logos as ownership markers, rings (green pump / red dump / gold apex), flame/rocket badges on hot tokens, compact control summary.
3. **War Log** - terminal feed with token logos, short meme-tone lines, color by severity, newest glows; "Full Log" opens a TacticalModal.
4. **Conflicts & Apex** - token-vs-token conflict cards with meme faces, Apex Survivors ranking with logos, stat chips.

## Top & bottom bars
- Animated radiation meter (reacts to level, glows when high) + War Cycle countdown; pulsing LIVE dot.
- Bottom: War Chest balance + Deploy, Raid, BUNKER, Propaganda, Council in the existing premium button style. Each opens a TacticalModal that links into the matching existing game screen (no new game rules).

## Data
- Reuses the same public War Room data (sectors, radiation, doomsday timer, feed) already used by /war-room; agents and log lines derive from it. War Chest shows the signed-in player's balance, or a sign-in prompt.
- Meme agent faces: generated illustrated tactical-gear meme portraits (original art, not copied images), small and cached.

## Technical details
- New `src/routes/war-command.tsx` with its own head() metadata; components under `src/components/war-command/` (StatusBar, PanelCarousel, AgentsPanel, BattlefieldPanel, WarLogPanel, ConflictsPanel, ActionBar).
- CSS scroll-snap carousel, `h-[100dvh] overflow-hidden`, `env(safe-area-inset-*)`; haptic on panel change via `@/lib/telegram`.
- Only HUD classes (`holo-panel`, `hud-card`, `hud-chip`, `cta-*`) and theme tokens; any new glow/pulse keyframes added to `src/styles.css`.
- Data via `getWarRoomFn` + `useCachedQuery`; pure derivation helpers (agent confidence, severity) in a small `src/lib/war-command/derive.ts` with unit tests.
