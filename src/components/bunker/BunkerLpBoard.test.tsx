import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BunkerLpBoard } from "./BunkerLpBoard";

const fixtures = vi.hoisted(() => {
  const doomsdayAt = Date.UTC(2027, 9, 31, 18);
  const day = 86_400_000;
  return {
    doomsdayAt,
    day,
    board: {
      rows: [],
      updatedAt: doomsdayAt - day,
      until: doomsdayAt,
      totalSurvivorWeight: 10,
      settlementPools: [{
        id: "pool-a",
        symbol: "DOGE",
        principalUsdt: 100,
        stableValueUsdt: 0,
        baseValueUsdt: 50,
        coinValueUsdt: 50,
        bunkerPoolShare: 0.1,
        volume24hUsdt: 10_000,
        lpFeeBps: 20,
        liquidationCostBps: 0,
      }],
      error: null,
    },
    mine: {
      signedIn: true,
      pledges: [{
        coinMaster: "coin-a",
        symbol: "DOGE",
        pool: "pool-a",
        lpUnits: "1000000000",
        lpUsd: 100,
        valueUsd: 100,
        poolShare: 0.1,
        feesPerDayUsd: 2,
        status: "holding",
        pledgedAt: new Date(doomsdayAt - 30 * day).toISOString(),
        until: new Date(doomsdayAt).toISOString(),
      }],
      error: null,
    },
  };
});

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/bunker.functions", () => ({ getLpBoardFn: () => null, getMyBunkerFn: () => null }));
vi.mock("@/lib/cache/use-cached", () => ({
  useCachedQuery: (key: string) => ({
    data: key === "bunker:lp-board:v2" ? fixtures.board : fixtures.mine,
    loading: false,
    refresh: async () => undefined,
  }),
}));
vi.mock("./BunkerLpModal", () => ({ BunkerLpModal: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Bunker USD₮ settlement HUD", () => {
  it("shows the live fee accrual and full survivor cashout before Doomsday", async () => {
    vi.spyOn(Date, "now").mockReturnValue(fixtures.doomsdayAt - fixtures.day / 2);
    render(<BunkerLpBoard />);
    const region = await within(document.body).findByLabelText("Doomsday USD₮ settlement projection");
    // 10k volume × 0.20% × 10% = 2/day; half a day accrued, half remains.
    expect(region.textContent).toContain("$1.00");
    expect(region.textContent).toContain("$102.00");
    expect(region.textContent).toContain("100.00%");
    expect(region.textContent).toContain("0/7 tranches");
  });

  it("moves the same projected cashout into claimable USD₮ after seven tranches", async () => {
    vi.spyOn(Date, "now").mockReturnValue(fixtures.doomsdayAt + 7 * fixtures.day);
    render(<BunkerLpBoard />);
    const region = await within(document.body).findByLabelText("Doomsday USD₮ settlement projection");
    expect(region.textContent).toContain("7/7 tranches");
    expect(region.textContent).toContain("$102.00");
    expect(region.textContent).toContain("100.00%");
  });
});
