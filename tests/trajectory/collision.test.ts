import { describe, expect, it } from "vitest";

import { detectCollision } from "@/lib/trajectory/collision";
import type { TrajectoryResult } from "@/lib/trajectory/types";
import { makeGoal } from "./fixtures";

function trajectory(monthsToGoal: number): TrajectoryResult {
  return {
    trajectoryAge: 25 + monthsToGoal / 12,
    monthlySurplus: 45_000,
    savedAmount: 0,
    monthsToGoal,
    cohortPercentile: null,
  };
}

const homeGoal = { goal: makeGoal({ type: "home" }), trajectory: trajectory(12) };

describe("detectCollision", () => {
  it("reports no collision for goals 30 months apart", () => {
    const result = detectCollision(homeGoal, {
      goal: makeGoal({ type: "wedding" }),
      trajectory: trajectory(42),
    });
    expect(result.collides).toBe(false);
    expect(result.overlapMonths).toBe(0);
    expect(result.resolutionOptions).toHaveLength(0);
  });

  it("reports a collision with 18 months of overlap for goals 6 months apart", () => {
    const result = detectCollision(homeGoal, {
      goal: makeGoal({ type: "wedding" }),
      trajectory: trajectory(18),
    });
    expect(result.collides).toBe(true);
    expect(result.overlapMonths).toBe(18);
    expect(result.resolutionOptions.length).toBeGreaterThan(0);
  });

  it("treats goals exactly 24 months apart as not colliding", () => {
    const result = detectCollision(homeGoal, {
      goal: makeGoal({ type: "wedding" }),
      trajectory: trajectory(36),
    });
    expect(result.collides).toBe(false);
  });

  it("is symmetric in argument order", () => {
    const a = { goal: makeGoal({ type: "home" }), trajectory: trajectory(10) };
    const b = { goal: makeGoal({ type: "wedding" }), trajectory: trajectory(20) };
    expect(detectCollision(a, b)).toEqual(detectCollision(b, a));
  });

});
