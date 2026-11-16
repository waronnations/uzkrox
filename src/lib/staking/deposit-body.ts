// Deposit message body per pool type (Tonstakers liquid, Whales, TF nominator).
import { beginCell, type Cell } from "@ton/core";
import { LIQUID_DEPOSIT_OP, WHALES_DEPOSIT_OP, PARTNER_CODE, type PoolKind } from "./staking";

export function depositBody(kind: PoolKind): Cell {
  if (kind === "liquidTF") return beginCell().storeUint(LIQUID_DEPOSIT_OP, 32).storeUint(0, 64).storeUint(PARTNER_CODE, 64).endCell();
  if (kind === "whales") return beginCell().storeUint(WHALES_DEPOSIT_OP, 32).storeUint(0, 64).storeCoins(100_000n).endCell();
  return beginCell().storeUint(0, 32).storeStringTail("d").endCell();
}
