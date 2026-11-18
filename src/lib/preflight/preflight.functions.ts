import { createServerFn } from "@tanstack/react-start";
import { moneyConfig } from "@/lib/money/config.server";
import { buildPreflight, preflightVerdict } from "./checks";

/** Readiness booleans only — never values, wallets or keys. */
export const getPreflight = createServerFn({ method: "GET" }).handler(async () => {
  const checks = buildPreflight(moneyConfig(), {
    sessionSecret: !!process.env.SESSION_SECRET,
    rateLimitShared: !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return { checks, verdict: preflightVerdict(checks), at: new Date().toISOString() };
});
