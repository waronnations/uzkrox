// src/components/game/GameModals.tsx
import { TutorialModal } from "@/components/TutorialModal";
import { IdleWelcomeModal } from "@/components/IdleWelcomeModal";
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

      <IdleWelcomeModal
        reward={game.state.pendingIdleReward}
        onClose={() => {
          game.claimIdleReward();
          void forceSync();
        }}
      />

    </>
  );
}
