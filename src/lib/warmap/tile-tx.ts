// Two-leg War Map payment messages (vault + marketing) with the tile comment.
import { beginCell } from "@ton/core";

export function commentPayload(comment: string): string {
  const bytes = new Uint8Array(beginCell().storeUint(0, 32).storeStringTail(comment).endCell().toBoc());
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function tileMessages(p: { vault: string; marketing: string; vaultNano: string; marketingNano: string; comment: string }) {
  const payload = commentPayload(p.comment);
  return [
    { address: p.vault, amount: p.vaultNano, payload },
    { address: p.marketing, amount: p.marketingNano, payload },
  ];
}
