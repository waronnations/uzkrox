# Meme Mayhem Unified Terminal — build plan

Built in 5 phases, in order. Each phase ships on its own so the game stays playable.

## Phase 1 — Home command HUD (zero-scroll mobile)
- Put the shared War Command deck on the Play screen above the Coin Board.
- Level 1 slim top strip (~36px): radiation meter, Doomsday countdown, live USD₮ vault pot, skirmish dot + one-line War Wire ticker, HUD toggle.
- Level 2 deck, collapsed by default (34px): 4 swipeable tabs — AI Agents, Sector Frontlines, Whale Radar, Apex Standings.
- Level 3 action tray: tapping a faction/sector opens a bottom tray with Quick Swap, Deploy WARDOG, Bunker Yield, Raid Squad (Telegram share link `startapp=raid_TICKER`).
- Check at 360x640 that the board never needs scrolling.

## Phase 2 — Coin logo pipeline
- Extend the logo endpoint to 4 sources in order: TonAPI, STON.fi, DeDust, swap.coffee lists.
- Cache results server-side; keep CachedTokenImage memory/local caching.
- Use the `master` prop everywhere coins appear (board, terminal, war log, bunker, standings).

## Phase 3 — Top 100 arena, 50 USD₮ promoted slots, 6h Death Clock
- Roster capped at 100: promoted slots first, rest ranked by market cap, 24h volume and raid heat.
- Promoted slot purchase: 50 USD₮ minimum via TonConnect, verified on-chain before granting; fee counted into the War Vault.
- Ranks 95–100 or expiring promotions start a 6-hour Death Clock with an alert banner; token is delisted when it ends unless rescued.

## Phase 4 — War Vault split
- Vault pot totals listing fees, boosts and war taxes.
- Doomsday split, pure and tested: 60% bunker survivors (sqrt(value) x days), 25% top-3 faction holders, 15% top-10 apex players.
- Show projected shares in the HUD and Bunker.

## Phase 5 — Whale Radar
- Index DEX swaps above $5,000 on STON.fi and DeDust for listed coins.
- Feed the Whale Radar tab; flash green (buy) / amber (dump) alert in the terminal.
- Quick Swap keeps the existing swap.coffee flow (live quote, gas cap check, TonConnect signing).

## Technical notes
- Reuse WarCommandDeck, TacticalModal, HUD classes and theme tokens only.
- New rules (roster, death clock, split) live in pure modules with unit tests.
- Public data keeps going through the War Room snapshot, no personal data.
- Payouts are shown as projections; actual payouts reuse the existing War Vault voucher signing.
