// Live War Map tiles from the server (30s cache, shared by the map and the War Command strip).
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { getWarMapFn } from "@/lib/warmap.functions";
import { tilesFromServer } from "@/lib/syndicate/hud";

export function useWarMap() {
  const get = useServerFn(getWarMapFn);
  const q = useCachedQuery("warmap:tiles", 30_000, () => get(), { refreshMs: 30_000 });
  const parsed = useMemo(() => tilesFromServer(q.data?.tiles ?? []), [q.data]);
  return { ...q, ...parsed, vaultGram: q.data?.vaultGram ?? 0 };
}
