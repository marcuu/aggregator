import { describe, expect, it } from "vitest";

import { attributeSavingsToGoals, type FinancialState } from "@/lib/finance/state";
import { projectUserGoals, projectUserGoalsSolo } from "@/lib/usecases/trajectory";
import { detectCollision } from "@/lib/trajectory/collision";
import { unsafePence } from "@/lib/money";
import type { Transaction } from "@/lib/trajectory/types";
import { lawFastBenchmarks, makeGoal, makeProfile } from "../trajectory/fixtures";

/**
 * Use-case-level test for the goal-progress loop. Exercises the finance +
 * use-case layers together (attribution → allocated projection → collision)
 * but stops short of the route handler — the route-level regression guard
 * lives in dashboard-route.test.ts, which drives GET /api/dashboard through a
 * faked Supabase client and would catch a route that skips the service.
 *
 * Here we assert the assembled use-case behaves:
 *   (a) saved-toward-goal reflects synced balances, not 0;
 *   (b) two competing goals collide and finish later combined than alone;
 *   (c) projected age moves when balances move.
 */

const AS_OF = new Date("2026-05-18T00:00:00Z");

function monthlyTransactions(incomePence: number, spendPence: number): Transaction[] {
  const dates = ["2026-03-01", "2026-04-01", "2026-05-01"];
  return dates.flatMap((date, i) => [
    { id: `inc-${i}`, amount: incomePence, date, category: "salary", description: "salary" },
    { id: `spend-${i}`, amount: -spendPence, date, category: "rent", description: "rent" },
  ]);
}

function stateWithSavings(savingsPence: number): FinancialState {
  return {
    liquidBalance: unsafePence(savingsPence),
    savingsBalance: unsafePence(savingsPence),
    monthlySurplus: unsafePence(45_000),
  };
}

describe("goal-progress loop (use-case)", () => {
  const profile = makeProfile();
  const transactions = monthlyTransactions(300_000, 255_000); // £450/mo surplus
  const homeGoal = makeGoal({ id: "home-1", type: "home", target_amount: 22_000 });

  it("(a) attributes synced balances to a goal instead of leaving it at 0", () => {
    const state = stateWithSavings(500_000); // £5,000 in savings
    const saved = attributeSavingsToGoals([homeGoal], state);

    // Single goal soaks up all attributed savings (capped at target).
    expect(saved.get("home-1")).toBe(500_000);

    const [entry] = projectUserGoals({
      profile,
      goals: [homeGoal],
      transactions,
      benchmarks: lawFastBenchmarks,
      savedByGoal: saved,
      asOfDate: AS_OF,
    });
    expect(entry.trajectory.savedAmount).toBe(500_000);
  });

  it("(b) two competing goals collide and finish later combined than alone", () => {
    const wedding = makeGoal({ id: "wed-1", type: "wedding", target_amount: 20_000 });
    const goals = [homeGoal, wedding];
    const noSavings = new Map<string, number>([
      ["home-1", 0],
      ["wed-1", 0],
    ]);

    const combined = projectUserGoals({
      profile,
      goals,
      transactions,
      benchmarks: lawFastBenchmarks,
      savedByGoal: noSavings,
      asOfDate: AS_OF,
    });

    const weddingAlone = projectUserGoals({
      profile,
      goals: [wedding],
      transactions,
      benchmarks: lawFastBenchmarks,
      savedByGoal: new Map([["wed-1", 0]]),
      asOfDate: AS_OF,
    })[0];

    const weddingCombined = combined.find((e) => e.goal.id === "wed-1")!;

    // Sequential allocation funds the home goal first, so the wedding takes
    // strictly longer when both compete for the same surplus.
    expect(weddingCombined.trajectory.monthsToGoal).toBeGreaterThan(
      weddingAlone.trajectory.monthsToGoal,
    );

    // Collision is judged on the solo windows: both goals want the surplus in
    // overlapping periods, so they collide even though the allocator has
    // already serialised them.
    const solo = projectUserGoalsSolo({
      profile,
      goals,
      transactions,
      benchmarks: lawFastBenchmarks,
      savedByGoal: noSavings,
      asOfDate: AS_OF,
    });
    const collision = detectCollision(solo[0], solo[1]);
    expect(collision.collides).toBe(true);
  });

  it("(c) projected age improves when the attributed balance rises", () => {
    const poor = projectUserGoals({
      profile,
      goals: [homeGoal],
      transactions,
      benchmarks: lawFastBenchmarks,
      savedByGoal: new Map([["home-1", 0]]),
      asOfDate: AS_OF,
    })[0];

    const rich = projectUserGoals({
      profile,
      goals: [homeGoal],
      transactions,
      benchmarks: lawFastBenchmarks,
      savedByGoal: new Map([["home-1", 1_000_000]]), // £10k already saved
      asOfDate: AS_OF,
    })[0];

    expect(rich.trajectory.monthsToGoal).toBeLessThan(poor.trajectory.monthsToGoal);
    expect(rich.trajectory.trajectoryAge).toBeLessThan(poor.trajectory.trajectoryAge);
  });
});
