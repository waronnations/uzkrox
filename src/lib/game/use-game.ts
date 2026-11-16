// src/lib/game/use-game.ts
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_ENERGY,
  LOCAL_BOARD_LOCK_MS,
  STARTER_PACK,
  type EnergyTreasuryZone,
} from "@/lib/constants";
import type { GameState } from "./types";
import {
  initialState,
  load,
  pickDailyQuests,
  save,
} from "./helpers";
import {
  canClaimDailyPure,
  claimDailyQuestState,
  claimDailyState,
  claimTaskState,
  refreshDailyQuestsIfNeeded,
  type DailyClaimResult,
} from "./daily";
import {
  calculateIdleUpdate,
  claimIdleRewardState,
  dismissIdleRewardState,
} from "./idle";
import {
  computeRecoverEnergy,
  energyRegenTick,
  type LocalRecoverResult,
} from "./energy";
import {
  applyServerEconomyLogic,
  applyServerStateLogic,
  hydrateState,
} from "./server-reconcile";
import { getTreasuryHealthFn } from "@/lib/treasury.functions";
export type { DailyClaimResult, LocalRecoverResult };

/** Legacy saves may still hold old-board "Live Target" cells; drop them on load. */
function stripTargetCells(board: GameState["board"]): GameState["board"] {
  return (board ?? []).map((c) => (c && (c as { isTarget?: boolean }).isTarget ? null : c));
}

const ZONE_REFRESH_MS = 12_000;

export function useGame() {
  const [state, setState] = useState<GameState>(() => initialState());
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef<GameState>(state);

  const boardRevisionRef = useRef(0);
  const localBoardLockUntilRef = useRef(0);
  const treasuryZoneRef = useRef<EnergyTreasuryZone>("yellow");

  const bumpBoardRevision = () => {
    boardRevisionRef.current += 1;
    localBoardLockUntilRef.current = Date.now() + LOCAL_BOARD_LOCK_MS;
  };

  // Load + strip any sticky local-only targets left from a previous session
  useEffect(() => {
    const loaded = load();
    const board = stripTargetCells(loaded.board ?? []);
    const cleaned: GameState = {
      ...loaded,
      board,
      warMode: loaded.warMode
        ? {
            ...loaded.warMode,
            // Keep targets list only while War Mode is still active
            targets: loaded.warMode.active
              ? loaded.warMode.targets ?? []
              : [],
          }
        : loaded.warMode,
    };
    stateRef.current = cleaned;
    setState(cleaned);
    setHydrated(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
    if (hydrated) save(state);
  }, [state, hydrated]);

  // Treasury zone
  useEffect(() => {
    let cancelled = false;
    const refreshZone = async () => {
      try {
        const snap = await getTreasuryHealthFn();
        if (cancelled || !snap?.zone) return;
        if (
          snap.zone === "green" ||
          snap.zone === "yellow" ||
          snap.zone === "red" ||
          snap.zone === "critical"
        ) {
          treasuryZoneRef.current = snap.zone;
        }
      } catch {
        /* offline */
      }
    };
    void refreshZone();
    const int = setInterval(() => void refreshZone(), ZONE_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(int);
    };
  }, []);

  // Daily quests
  useEffect(() => {
    const check = () => {
      setState((s) => {
        const next = refreshDailyQuestsIfNeeded(s, pickDailyQuests);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    };
    const int = setInterval(check, 60_000);
    return () => clearInterval(int);
  }, []);

  // Energy regen
  useEffect(() => {
    const interval = setInterval(() => {
      setState((s) => {
        const next = energyRegenTick(s, treasuryZoneRef.current);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Idle
  useEffect(() => {
    if (!hydrated) return;
    const calculateIdle = () => {
      setState((s) => {
        const next = calculateIdleUpdate(s);
        if (!next) return s;
        stateRef.current = next;
        return next;
      });
    };
    calculateIdle();
    const onVis = () => {
      if (document.visibilityState === "visible") calculateIdle();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [hydrated]);

  const claimDaily = useCallback((): DailyClaimResult => {
    const s = stateRef.current;
    const outcome = claimDailyState(s);
    if (!outcome) return null;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return outcome.result;
  }, []);

  const canClaimDaily = useCallback(() => canClaimDailyPure(stateRef.current), []);

  const claimTask = useCallback((id: string) => {
    const s = stateRef.current;
    const outcome = claimTaskState(s, id);
    if (!outcome.ok) return outcome;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return { ok: true as const };
  }, []);

  const claimDailyQuest = useCallback((id: string) => {
    const s = stateRef.current;
    const outcome = claimDailyQuestState(s, id);
    if (!outcome.ok) return outcome;
    stateRef.current = outcome.nextState;
    setState(outcome.nextState);
    return { ok: true as const };
  }, []);

  const claimIdleReward = useCallback(() => {
    setState((s) => {
      const next = claimIdleRewardState(s);
      if (!next) return s;
      stateRef.current = next;
      return next;
    });
  }, []);

  const dismissIdleReward = useCallback(() => {
    setState((s) => {
      const next = dismissIdleRewardState(s);
      if (!next) return s;
      stateRef.current = next;
      return next;
    });
  }, []);

  const dismissTutorial = useCallback(() => {
    setState((s) => {
      const next = { ...s, hasSeenTutorial: true };
      stateRef.current = next;
      return next;
    });
  }, []);

  const grantStarterPack = useCallback(() => {
    setState((s) => {
      if (s.hasSeenTutorial) return s;
      const next = {
        ...s,
        hasSeenTutorial: true,
        glory: s.glory + STARTER_PACK.glory,
        energy: Math.min(MAX_ENERGY, s.energy + STARTER_PACK.energy),
        wardogTokens: s.wardogTokens + STARTER_PACK.wardog,
        warcatTokens: s.warcatTokens + STARTER_PACK.warcat,
        lastSeenAt: Date.now(),
      };
      stateRef.current = next;
      return next;
    });
  }, []);

  const recoverEnergy = useCallback(
    (_payWith?: "wardog" | "warcat"): LocalRecoverResult => {
      const s = stateRef.current;
      const outcome = computeRecoverEnergy(s);
      if (!outcome.ok) return outcome;
      stateRef.current = outcome.nextState;
      setState(outcome.nextState);
      return {
        ok: true,
        energy: outcome.energy,
        spent: outcome.spent,
      };
    },
    [],
  );

  const hydrate = useCallback((partial: Partial<GameState>) => {
    setState((s) => {
      const next = hydrateState(s, partial);
      stateRef.current = next;
      return next;
    });
  }, []);

  const applyServerState = useCallback((incoming: GameState) => {
    setState((s) => {
      const { next, preferLocalBoard } = applyServerStateLogic(s, incoming, {
        boardRevision: boardRevisionRef.current,
        localBoardLockUntil: localBoardLockUntilRef.current,
      });
      if (!preferLocalBoard) boardRevisionRef.current = 0;
      // Never reintroduce targets from server
      const cleaned = {
        ...next,
        board: stripTargetCells(next.board),
      };
      stateRef.current = cleaned;
      return cleaned;
    });
  }, []);

  const applyServerEconomy = useCallback((incoming: Partial<GameState>) => {
    setState((s) => {
      const { next, boardChanged } = applyServerEconomyLogic(s, incoming);
      if (boardChanged) {
        boardRevisionRef.current += 1;
        localBoardLockUntilRef.current = Date.now() + LOCAL_BOARD_LOCK_MS;
      }
      stateRef.current = next;
      return next;
    });
  }, []);

  return {
    state,
    hydrated,
    claimDaily,
    canClaimDaily,
    claimTask,
    claimDailyQuest,
    claimIdleReward,
    dismissIdleReward,
    dismissTutorial,
    grantStarterPack,
    recoverEnergy,
    hydrate,
    applyServerState,
    applyServerEconomy,

  };
}
