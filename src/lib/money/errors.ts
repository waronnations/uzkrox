// Player-facing text for stable money-path error codes (client-safe).
const TEXT: Record<string, string> = {
  config_incomplete: "Live payments are paused while setup finishes — try the simulation",
  money_paths_disabled: "Live payments aren't switched on yet — try the simulation",
  rate_limited: "Too many attempts — wait a minute and try again",
  sector_contested: "Another claim on this sector is in progress — try again in a few minutes",
  faction_holds_sector: "Your faction already holds this sector",
  confirmation_service_unavailable: "Payment check is unavailable — we'll keep checking, try again shortly",
  storage_unavailable: "Saving isn't available yet",
  wallet_message_mismatch: "That wallet transaction doesn't match your connected wallet",
  claim_not_found: "Claim not found",
  promotion_not_found: "Promotion not found",
};
export const moneyErrorText = (code: string | undefined) => (code && TEXT[code]) || code || "Something went wrong";
