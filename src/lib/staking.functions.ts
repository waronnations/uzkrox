// Public list of live TON/GRAM staking pools (deposits are signed by the player via TonConnect).
import { createServerFn } from "@tanstack/react-start";

export const getStakingPoolsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { stakingPools } = await import("@/lib/staking/pools.server");
  const { moneyConfig } = await import("@/lib/money/config.server");
  const c = moneyConfig();
  // Mock by default: estimates only. Live deposits need STAKING_PROVIDER + a valid pool + money paths on.
  const all = await stakingPools();
  const live = c.stakingLive;
  const pools = live ? all.filter((p) => p.address === c.stakingPool) : all;
  return { pools, provider: c.stakingProvider, live, paused: c.stakingProvider !== "mock" && !live };
});
