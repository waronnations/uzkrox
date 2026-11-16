# Clean Break: retire the old merge board, Coin Board becomes the only game

Play already shows only the Coin Board. The old merge board still runs underneath: its pop-ups (hybrid, cocoon, hybrid result), merge/spawn/hybrid logic, unit-image preloading, and war-mode code that reads the old grid. Every phase ends with the app booting and the Coin Board fully playable.

## Phase 1: Safety switch
- Add one central switch `ENABLE_CLASSIC_MERGE_BOARD = false` in `src/lib/constants/`.
- Put every old entry point behind it: hybrid/cocoon pop-ups in `GameModals`, hybrid/sacrifice handlers in `routes/index.tsx`, merge and spawn calls in `use-game.ts`, unit preloading, and war-mode paths that use the grid.
- Add a `// DEPRECATED – old unit merge board – scheduled for removal` comment to the old files (`merge.ts`, `spawn.ts`, `hybrid.ts`, `preload-units.ts`, `units.ts`, the server merge/spawn files, and the three modals).

## Phase 2: UI cleanup
- With the switch off, the three hybrid/cocoon pop-ups never mount.
- Find and remove any leftover "merge units", spawn, or energy-per-merge buttons and tooltips across tabs and the HUD.
- Play and Operations open straight onto the Coin Board.

## Phase 3: Remove dead code (only after Phases 1–2 pass)
- Replace `preload-units.ts`, `game/merge.ts`, `game/spawn.ts`, `game/hybrid.ts` with small stubs, or delete them once nothing imports them. Do the same for the server merge/spawn functions.
- Drop the old-board-only hybrid constants and types, and the unit-image references used only by the old board.
- `public/images/units/` (38 files) stays in place. I will ask you before deleting it.
- The old `merge`, `spawn` and `hybrid` tests are retired along with their code.

## Phase 4: Saved games and types
- Stop writing to `state.board` while the switch is off.
- Keep `Cell`, `board` and `pendingHybrid` as optional fields marked "legacy" so old saves still load. No database or schema changes.
- Separate the main energy loop from `ENERGY_PER_MERGE` and `SPAWN_ENERGY`. The old constants stay, marked legacy, until nothing uses them.

## Phase 5: Wording and checks
- Rewrite the tutorial, tooltips, quests, season text and HUD text that still mention merging units so they describe the Coin Board.
- Run the full test suite and fix only failures caused by this cleanup.
- Click through Nations, ranks, both tokens, Apocalypse, Bunker LP, War Room, referrals, shop and claims in the preview.
- Finish with a short summary of what was removed, what was kept, and what legacy pieces remain.

## Not touched
Swap routing, War Tax, the aggregator, the database schema, and saved player progress.

## Technical notes
- War Mode (`war-mode.ts`, `war-targets.ts`) is checked first. Any part that only works on the grid is switched off, and anything the Coin Board uses stays.
- Record the "Coin Board is the only primary board; classic merge is behind a switch and kept only for loading old saves" rule in AGENTS.md.
