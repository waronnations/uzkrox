// Public list of live TON/GRAM staking pools (deposits are signed by the player via TonConnect).
import { createServerFn } from "@tanstack/react-start";

export const getStakingPoolsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { stakingPools } = await import("@/lib/staking/pools.server");
  return { pools: await stakingPools() };
});
