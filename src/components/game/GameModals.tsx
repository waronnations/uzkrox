// src/components/game/GameModals.tsx
import { TutorialModal } from "@/components/TutorialModal";
import { useEffect } from "react";
import { toast } from "sonner";
import { DailyBonusModal } from "@/components/DailyBonusModal";
import { NukedLockModal } from "@/components/NukedLockModal";
import { OpsJailModal } from "@/components/OpsJailModal";
import { GlobalStrikeToast } from "@/components/GlobalStrikeToast";
import { GlobalOpsEventToast } from "@/components/GlobalOpsEventToast";
import type { useGame } from "@/lib/game-state";

export function GameModals({
  game,
  showDaily,
  setShowDaily,
  claimDaily,
  showTutorial,
  setShowTutorial,
  forceSync,
}: {
  game: ReturnType<typeof useGame>;
  showDaily: boolean;
  setShowDaily: (v: boolean) => void;
  claimDaily: () => void | Promise<void>;
  showTutorial: boolean;
  setShowTutorial: (v: boolean) => void;
  forceSync: () => Promise<unknown>;
}) {
  return (
    <>
      <NukedLockModal />
      <OpsJailModal />
      <GlobalStrikeToast />
      <GlobalOpsEventToast />

      <DailyBonusModal
        open={showDaily}
        onClaim={claimDaily}
        onClose={() => setShowDaily(false)}
        streak={game.state.dailyStreak}
      />

      <TutorialModal
        open={showTutorial}
        onComplete={() => {
          if (typeof game.grantStarterPack === "function") {
            game.grantStarterPack();
          } else if (typeof game.dismissTutorial === "function") {
            game.dismissTutorial();
          }
          setShowTutorial(false);
          void forceSync();
        }}
        onSkip={() => {
          if (typeof game.dismissTutorial === "function") {
            game.dismissTutorial();
          }
          setShowTutorial(false);
          void forceSync();
        }}
      />

      <IdleRewardAutoClaim game={game} forceSync={forceSync} />

    </>
  );
}

/** Idle earnings are credited silently with a toast instead of a launch pop-up. */
function IdleRewardAutoClaim({ game, forceSync }: { game: any; forceSync: () => unknown }) {
  const reward = game.state.pendingIdleReward;
  useEffect(() => {
    if (!reward) return;
    game.claimIdleReward();
    void forceSync();
    toast.success("Idle earnings collected");
  }, [reward]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
