// Money-path config: pure resolver so the fail-closed rule is testable. Server reads process.env.
export type StakingProvider = "mock" | "tonstakers" | "hipo";
export type MoneyEnv = Record<string, string | undefined>;
export type MoneyConfig = {
  enabled: boolean;
  marketingWallet: string | null;
  claimTreasury: string | null;
  tonapiKey: string | null;
  signerKey: string | null;
  missing: string[];
  ready: boolean;
  stakingProvider: StakingProvider;
  stakingPool: string | null;
  stakingLive: boolean;
};

const v = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
const isAddr = (s: string | null) => !!s && /^[A-Za-z0-9_\-:]{40,70}$/.test(s);

/** One flag (MONEY_PATHS_ENABLED) gates every value path; enabled + incomplete = refuse. */
export function resolveMoneyConfig(env: MoneyEnv): MoneyConfig {
  const enabled = env.MONEY_PATHS_ENABLED === "1" || env.MONEY_PATHS_ENABLED === "true";
  const marketingWallet = v(env.MARKETING_WALLET);
  const claimTreasury = v(env.CLAIM_TREASURY) ?? v(env.CLAIM_TREASURY_ADDRESS);
  const tonapiKey = v(env.TONAPI_KEY);
  const signerKey = v(env.WAR_VAULT_SIGNER_KEY) ?? v(env.CLAIM_SIGNER_PRIVATE_KEY);
  const missing: string[] = [];
  if (!isAddr(marketingWallet)) missing.push("MARKETING_WALLET");
  if (!isAddr(claimTreasury)) missing.push("CLAIM_TREASURY");
  if (!tonapiKey) missing.push("TONAPI_KEY");
  if (!signerKey) missing.push("WAR_VAULT_SIGNER_KEY");
  const p = env.STAKING_PROVIDER;
  const stakingProvider: StakingProvider = p === "tonstakers" || p === "hipo" ? p : "mock";
  const stakingPool = v(env.STAKING_POOL_ADDRESS);
  return {
    enabled, marketingWallet, claimTreasury, tonapiKey, signerKey, missing,
    ready: enabled && missing.length === 0,
    stakingProvider, stakingPool,
    stakingLive: stakingProvider !== "mock" && isAddr(stakingPool) && enabled,
  };
}

export class MoneyPathError extends Error {
  constructor(public code: "money_paths_disabled" | "config_incomplete", public missing: string[] = []) {
    super(code === "config_incomplete" ? `config_incomplete: ${missing.join(", ")}` : "money_paths_disabled");
  }
}

/** Throws unless live money paths are enabled and fully configured. */
export function assertMoneyReady(c: MoneyConfig): asserts c is MoneyConfig & { marketingWallet: string; claimTreasury: string; tonapiKey: string; signerKey: string } {
  if (!c.enabled) throw new MoneyPathError("money_paths_disabled");
  if (c.missing.length) throw new MoneyPathError("config_incomplete", c.missing);
}
