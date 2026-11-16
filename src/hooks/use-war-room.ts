// One shared, cached War Room feed for the command deck, Death Clock and vault cards.
import { useServerFn } from "@tanstack/react-start";
import { getWarRoomFn } from "@/lib/war-room.functions";
import { useCachedQuery } from "@/lib/cache/use-cached";

export function useWarRoom() {
  const get = useServerFn(getWarRoomFn);
  return useCachedQuery("warroom:snapshot", 60_000, () => get(), { refreshMs: 30_000 });
}
