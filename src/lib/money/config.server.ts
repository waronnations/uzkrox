import { resolveMoneyConfig, assertMoneyReady, MoneyPathError } from "./config";
export const moneyConfig = () => resolveMoneyConfig(process.env);
export function requireMoney(path: string) {
  const c = moneyConfig();
  try { assertMoneyReady(c); } catch (e) {
    if (e instanceof MoneyPathError) moneyLog("refused", { path, code: e.code, missing: e.missing });
    throw e;
  }
  return c;
}
/** Structured money-path log line (no secrets, no wallets). */
export function moneyLog(event: string, detail: Record<string, unknown>) {
  console.warn(JSON.stringify({ scope: "money", event, ...detail, at: new Date().toISOString() }));
}
