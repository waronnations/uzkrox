// src/hooks/use-game-handlers.ts
import { type GameState, type useGame } from "@/lib/game-state";
import { useEconomyHandlers } from "@/hooks/game-handlers/use-economy-handlers";
import { useDailyQuestsHandlers } from "@/hooks/game-handlers/use-daily-quests-handlers";
import { useNukeHandlers } from "@/hooks/game-handlers/use-nuke-handlers";

export { type PayToken, formatReason } from "@/hooks/game-handlers/helpers";

export function useGameHandlers({
  game,
  authenticated,
  serverReady,
  forceSync,
  pullFromServer,
  softRateLimitToast,
  setShowDaily,
}: {
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  serverReady: boolean;
  forceSync: () => Promise<unknown>;
  pullFromServer: () => Promise<unknown>;
  softRateLimitToast: () => void;
  setShowDaily: (v: boolean) => void;
}) {
  const { handleRecoverEnergy, handleShopBuy } = useEconomyHandlers({
    game,
    authenticated,
    pullFromServer,
    forceSync,
  });

  const { claimDaily, handleClaimTask, handleClaimDailyQuest } =
    useDailyQuestsHandlers({
      game,
      authenticated,
      forceSync,
      softRateLimitToast,
      setShowDaily,
    });

  const { handleLaunchNuke } = useNukeHandlers({
    game,
    authenticated,
    forceSync,
  });

  return {
    claimDaily,
    handleRecoverEnergy,
    handleShopBuy,
    handleLaunchNuke,
    handleClaimTask,
    handleClaimDailyQuest,
  };
}
