// Public jetton logo resolver: redirects to the token's real logo (TonAPI,
// STON.fi, DeDust, then swap.coffee) so every coin in the game shows its logo.
// Public data only — no user or wallet information is read.
import { createFileRoute } from "@tanstack/react-router";

const ADDR = /^[A-Za-z0-9_:\-]{40,80}$/;
const memo = new Map<string, { url: string | null; at: number }>();
const TTL = 6 * 3_600_000;

function ipfs(u?: string | null) {
  if (!u) return null;
  return u.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${u.slice(7)}` : u;
}

async function resolve(master: string): Promise<string | null> {
  const hit = memo.get(master);
  if (hit && Date.now() - hit.at < TTL) return hit.url;
  let url: string | null = null;
  try {
    const key = process.env.TONAPI_KEY;
    const res = await fetch(`https://tonapi.io/v2/jettons/${encodeURIComponent(master)}`, {
      headers: key ? { Accept: "application/json", Authorization: `Bearer ${key}` } : { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const j = (await res.json()) as { preview?: string; metadata?: { image?: string } };
      url = j.preview || ipfs(j.metadata?.image);
    }
  } catch (e) {
    console.error("jetton-logo", e);
  }
  if (!url) {
    try {
      const res = await fetch(`https://api.ston.fi/v1/assets/${encodeURIComponent(master)}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) url = ((await res.json()) as { asset?: { image_url?: string } }).asset?.image_url ?? null;
    } catch (e) {
      console.error("jetton-logo ston", e);
    }
  }
  if (!url) {
    try {
      const res = await fetch(`https://api.dedust.io/v2/assets`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const list = (await res.json()) as { address?: string; image?: string }[];
        url = list.find((a) => a.address === master)?.image ?? null;
      }
    } catch (e) {
      console.error("jetton-logo dedust", e);
    }
  }
  if (!url) {
    try {
      const res = await fetch(`https://tokens.swap.coffee/api/v3/jettons/${encodeURIComponent(master)}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) url = ((await res.json()) as { image_url?: string }).image_url ?? null;
    } catch (e) {
      console.error("jetton-logo swapcoffee", e);
    }
  }
  memo.set(master, { url, at: Date.now() });
  return url;
}

export const Route = createFileRoute("/api/public/jetton-logo/$master")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const master = params.master;
        if (!ADDR.test(master)) return new Response("bad address", { status: 400 });
        const url = await resolve(master);
        if (!url) return new Response("not found", { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
        return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "public, max-age=86400" } });
      },
    },
  },
});
