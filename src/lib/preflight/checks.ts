// Pre-flight readiness: pure, so the operator deck shows the same verdict the money paths enforce.
import type { MoneyConfig } from "@/lib/money/config";
export type CheckState = "ok" | "warn" | "off";
export type PreflightCheck = { id: string; label: string; state: CheckState; note: string };

export function buildPreflight(c: MoneyConfig, extra: { sessionSecret: boolean; rateLimitShared: boolean }): PreflightCheck[] {
  const has = (k: string) => !c.missing.includes(k);
  const item = (id: string, label: string, ok: boolean, okNote: string, badNote: string, soft = false): PreflightCheck =>
    ({ id, label, state: ok ? "ok" : soft ? "warn" : "off", note: ok ? okNote : badNote });
  return [
    item("money", "Money paths", c.enabled, "Enabled", "Disabled — real payments blocked"),
    item("marketing", "Marketing wallet", has("MARKETING_WALLET"), "Set", "Not set"),
    item("treasury", "Claim treasury", has("CLAIM_TREASURY"), "Set", "Not set"),
    item("tonapi", "TON API key", has("TONAPI_KEY"), "Set", "Not set"),
    item("signer", "Vault signer key", has("WAR_VAULT_SIGNER_KEY"), "Set", "Not set"),
    item("staking", "Staking", c.stakingLive, `Live (${c.stakingProvider})`, "Estimate only", true),
    item("session", "Session secret", extra.sessionSecret, "Set", "Not set"),
    item("ratelimit", "Shared rate limit", extra.rateLimitShared, "Redis", "Per-worker memory", true),
  ];
}

export function preflightVerdict(checks: PreflightCheck[]): "ready" | "blocked" {
  return checks.some((c) => c.state === "off") ? "blocked" : "ready";
}
