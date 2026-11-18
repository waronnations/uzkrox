import { describe, it, expect } from "vitest";
import { resolveMoneyConfig } from "@/lib/money/config";
import { buildPreflight, preflightVerdict } from "./checks";
const addr = "EQ" + "A".repeat(46);
describe("preflight", () => {
  it("blocks when money paths are off", () => {
    const c = buildPreflight(resolveMoneyConfig({}), { sessionSecret: true, rateLimitShared: false });
    expect(preflightVerdict(c)).toBe("blocked");
  });
  it("is ready when fully configured even with soft warnings", () => {
    const cfg = resolveMoneyConfig({ MONEY_PATHS_ENABLED: "1", MARKETING_WALLET: addr, CLAIM_TREASURY: addr, TONAPI_KEY: "k", WAR_VAULT_SIGNER_KEY: "s" });
    const c = buildPreflight(cfg, { sessionSecret: true, rateLimitShared: false });
    expect(preflightVerdict(c)).toBe("ready");
  });
});
