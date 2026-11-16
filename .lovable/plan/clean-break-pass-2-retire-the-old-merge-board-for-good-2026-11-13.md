# Clean Break, Pass 2: Retire the old merge board for good

## 1. Hard-disable remaining old UI
- `GameModals.tsx`: render HybridModal, HybridResultModal, CocoonGenerateModal (and ConquestModal if it only serves the unit grid) only behind `ENABLE_CLASSIC_MERGE_BOARD`; with the flag off they are never mounted or imported eagerly (lazy import behind the flag).
- `use-board-handlers.ts`: open-hybrid / cocoon / merge / spawn handlers become no-ops when the flag is off.
- Search all nav, tabs, menus, shop items and routes for buttons that open the old board, hybrid lab or cocoon; remove them or hide behind the flag.

## 2. Clean text and quests
- Scan `achievements.ts`, `daily.ts` quests, tutorial, tooltips, toasts, shop copy and i18n strings for "merge units / dog / cat / hybrid / tier / cocoon".
- Rewrite to Coin Board language (absorb, total war, alliance, retreat, memecoins), tactical tone.
- Quest/achievement IDs stay the same so saved progress keeps counting; only names and descriptions change. Goals tied to unit merges are retargeted to Coin Board actions already tracked.

## 3. Safe stubbing
- Stub (not delete) `game/merge.ts`, `game/spawn.ts`, `game/hybrid.ts`, `preload-units.ts`, `server/merge.server.ts`, `server/spawn.server.ts`, `server/hybrid.server.ts`: keep exported signatures, return unchanged state / reject with "classic board retired", header comment `@legacy` explaining why.
- `units.ts` and `classic-board.ts`: keep only what saves/types still need, mark the rest legacy.
- `game.server.ts` / `use-game.ts`: drop calls into the stubbed logic.
- `GameState` types: keep all old fields, add `/** @legacy classic board, kept for old saves */` comments.
- 38 unit images untouched; produce a list in the report.
- Untouched: swap routing, War Tax, aggregator, trading, DB schema.

## 4. Verification
- Typecheck via build log, run full `vitest` suite, update tests that exercised old merge/spawn logic to assert the stub behaviour.
- Playwright on the mobile viewport: app boots, Play tab shows only the Coin Board, then open Nations, tokens, Apocalypse, Bunker, War Room, shop, claims, seasons tabs and check they render without errors (signed-in checks where available).
- Record the retirement rule in AGENTS.md.

## Report
What was stubbed/removed, what was kept (images list, legacy save fields), remaining legacy pieces.
