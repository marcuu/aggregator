import { describe, expect, it } from "vitest";

import { project, type ProjectionGoal } from "@/lib/trajectory/projection";
import { lawFastBenchmarks, makeGoal, makeProfile } from "./fixtures";

const AS_OF = new Date("2026-05-18T00:00:00Z");

function goalState(
  id: string,
  type: ProjectionGoal["goal"]["type"],
  targetPence: number,
  savedPence = 0,
  earliestMonth = 0,
): ProjectionGoal {
  return {
    goal: makeGoal({ id, type }),
    targetPence,
    savedPence,
    earliestMonth,
  };
}

describe("project — surplus allocation", () => {
  it("sequential: funds the priority goal first, delaying the second", () => {
    const goals = [
      goalState("home", "home", 2_200_000),
      goalState("wed", "wedding", 2_000_000),
    ];
    const result = project({
      profile: makeProfile(),
      goals,
      benchmarks: lawFastBenchmarks,
      monthlySurplusPence: 45_000,
      asOfDate: AS_OF,
      allocation: "sequential",
    });

    const home = result.perGoal.find((g) => g.goalId === "home")!;
    const wed = result.perGoal.find((g) => g.goalId === "wed")!;

    // Home (priority 0) completes first; wedding only starts funding after.
    expect(home.monthsToGoal).toBeLessThan(wed.monthsToGoal);
    // The wedding's completion is roughly home + its own funding window, far
    // later than if it had owned the surplus alone (~37 months).
    expect(wed.monthsToGoal).toBeGreaterThan(home.monthsToGoal + 20);
  });

  it("split: both goals progress simultaneously", () => {
    const goals = [
      goalState("home", "home", 2_200_000),
      goalState("wed", "wedding", 2_000_000),
    ];
    const result = project({
      profile: makeProfile(),
      goals,
      benchmarks: lawFastBenchmarks,
      monthlySurplusPence: 45_000,
      asOfDate: AS_OF,
      allocation: "split",
    });

    const home = result.perGoal.find((g) => g.goalId === "home")!;
    const wed = result.perGoal.find((g) => g.goalId === "wed")!;

    // Splitting surplus proportional to remaining need funds both in
    // parallel, so they complete within a narrow window of each other —
    // unlike sequential funding which serialises them far apart.
    expect(Math.abs(home.monthsToGoal - wed.monthsToGoal)).toBeLessThanOrEqual(12);
  });

  it("honours earliestMonth as a completion floor", () => {
    const goals = [goalState("home", "home", 2_200_000, 2_200_000, 24)];
    const result = project({
      profile: makeProfile(),
      goals,
      benchmarks: lawFastBenchmarks,
      monthlySurplusPence: 45_000,
      asOfDate: AS_OF,
      allocation: "sequential",
    });
    // Already funded, but the user parked it 24 months out.
    expect(result.perGoal[0].monthsToGoal).toBe(24);
    expect(result.perGoal[0].rawMonthsToGoal).toBe(0);
  });

  it("draws savings down when a goal completes, then rebuilds for the next", () => {
    const goals = [
      goalState("home", "home", 3_000_000),
      goalState("ef", "emergency_fund", 1_000_000),
    ];
    const result = project({
      profile: makeProfile(),
      goals,
      benchmarks: lawFastBenchmarks,
      monthlySurplusPence: 60_000,
      asOfDate: AS_OF,
      allocation: "sequential",
      minHorizonMonths: 120,
    });

    const home = result.perGoal.find((g) => g.goalId === "home")!;
    const ef = result.perGoal.find((g) => g.goalId === "ef")!;

    const savingsAt = (m: number) =>
      result.series[m].cumulativeSavingsPence;

    // Savings climbs while the home deposit is being funded...
    expect(savingsAt(home.monthsToGoal - 1)).toBeGreaterThan(savingsAt(1));
    // ...then drops the month the home completes (the deposit is spent).
    expect(savingsAt(home.monthsToGoal)).toBeLessThan(
      savingsAt(home.monthsToGoal - 1),
    );
    // The emergency fund then rebuilds savings before its own completion...
    expect(savingsAt(ef.monthsToGoal - 1)).toBeGreaterThan(
      savingsAt(home.monthsToGoal),
    );
    // ...and drains again once it too is met.
    expect(savingsAt(ef.monthsToGoal)).toBeLessThan(
      savingsAt(ef.monthsToGoal - 1),
    );
  });

  it("keeps saving after the last goal completes (residual pot grows)", () => {
    const goals = [goalState("home", "home", 2_200_000)];
    const result = project({
      profile: makeProfile(),
      goals,
      benchmarks: lawFastBenchmarks,
      monthlySurplusPence: 60_000,
      asOfDate: AS_OF,
      allocation: "sequential",
      minHorizonMonths: 120,
    });

    const home = result.perGoal[0];
    const savingsAt = (m: number) => result.series[m].cumulativeSavingsPence;

    // The deposit is spent the month home completes, so savings dip...
    expect(savingsAt(home.monthsToGoal)).toBeLessThan(
      savingsAt(home.monthsToGoal - 1),
    );
    // ...but the user keeps saving afterward, so the curve climbs again
    // rather than flatlining at zero.
    const lastMonth = result.series[result.series.length - 1].month;
    expect(savingsAt(lastMonth)).toBeGreaterThan(savingsAt(home.monthsToGoal));
    expect(savingsAt(lastMonth)).toBeGreaterThan(savingsAt(home.monthsToGoal + 1));
  });

  it("emits a series at least as long as minHorizonMonths with no goals", () => {
    const result = project({
      profile: makeProfile(),
      goals: [],
      benchmarks: lawFastBenchmarks,
      monthlySurplusPence: 45_000,
      asOfDate: AS_OF,
      minHorizonMonths: 120,
    });
    expect(result.series.length).toBeGreaterThanOrEqual(121);
  });
});
