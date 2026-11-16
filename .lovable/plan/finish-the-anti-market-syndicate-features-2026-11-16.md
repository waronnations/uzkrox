# Finish the Anti-Market Syndicate features

Most of the server work already exists: war map reads and claims, the staking pool list, harvest signals in the public War Room data, and the pure rules in `src/lib/syndicate/rules.ts`. This plan connects those to the screens.

## 1. War Map goes live
- Load sectors from the server and refresh them every 30 seconds. The practice claims saved on each device go away.
- Claim flow: the server prepares the claim, then the player signs one TonConnect transfer with two messages (60% to the Claim Treasury, 40% to the marketing wallet, both tagged with the tile comment). The server then confirms it against TonAPI. Ownership shows only after that confirmation.
- A "Citadel Dominance" bar at the top shows each faction's share of the map and its multiplier (+10% to +30% at 15% share or more).
- Clear messages for: wallet not connected, signing cancelled, still confirming, and sector already taken.

## 2. Bunker: two tabs
- The Bunker pop-up gets a "Meme LP Shelter" tab (the current LP lock, unchanged) and a "TON Yield Staking" tab.
- The staking tab lists the verified pools with APY, TVL and minimum stake. Players get a one-tap form that checks the amount against the pool minimum and fee, then sends the right deposit message for that pool type through TonConnect.
- It also shows the estimated survivor-weight boost: √value × (1 + days/7) × citadel multiplier.

## 3. "Sell-The-Top" warning in War Command
- The deck reads harvest signals from the shared War Room data. When a faction coin hits RSI above 80 with 3x volume or more, a warning appears with the coin, its RSI, the volume multiple, a projected 15% skim to USD₮, and "Raid / Defend" and "Promote Shield" buttons. "Promote Shield" opens the existing promotion pop-up.
- The deck also gets a compact strip showing each faction's share of the map.

## 4. Weekly Cull board (Arena)
- New board listing the bottom 5 coins that aren't promoted (uses `cullList`), with a countdown to the next Sunday settlement.
- Each row has a "Save Coin (50 USD₮)" button that opens the existing PromoteModal.

## 5. Tests
- Add pure helpers and tests in `src/lib/` for: the next-Sunday countdown, building the two war-map payments (amounts in nano, 60/40 split, rounding), building the staking deposit message for each pool type, and picking the harvest warning.
- Run the full vitest suite and check the build.

## Technical notes
- All UI uses the shared HUD classes and theme tokens only. Pop-ups use TacticalModal. Market reads go through `useCachedQuery`.
- Cull/settlement time uses UTC Sunday 00:00. Tell me if the settlement runs at a different time.
- Staking stays non-custodial, and the swap/claim caps don't change.
