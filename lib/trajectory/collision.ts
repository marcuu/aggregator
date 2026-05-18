import type { Goal } from "@/lib/validators/goals";
import type { TrajectoryResult } from "./types";

export type ResolutionOption = {
  id: string;
  description: string;
  yearsImpact: number;
};

export type CollisionResult = {
  collides: boolean;
  overlapMonths: number;
  resolutionOptions: ResolutionOption[];
};

/** Goals whose completion dates fall within this gap are treated as colliding. */
const COLLISION_WINDOW_MONTHS = 24;

/**
 * Detect whether two goals collide — i.e. their completion windows are close
 * enough that funding both at once strains the same surplus.
 */
export function detectCollision(
  goal1: { goal: Goal; trajectory: TrajectoryResult },
  goal2: { goal: Goal; trajectory: TrajectoryResult },
): CollisionResult {
  void goal1.goal;
  void goal2.goal;

  const diff = Math.abs(
    goal1.trajectory.monthsToGoal - goal2.trajectory.monthsToGoal,
  );

  if (diff >= COLLISION_WINDOW_MONTHS) {
    return { collides: false, overlapMonths: 0, resolutionOptions: [] };
  }

  return {
    collides: true,
    overlapMonths: COLLISION_WINDOW_MONTHS - diff,
    resolutionOptions: [
      {
        id: "sequence",
        description:
          "Sequence goals — complete first before starting second",
        yearsImpact: 0,
      },
      {
        id: "reduce_target",
        description: "Reduce target on one goal",
        yearsImpact: -0.8,
      },
      {
        id: "extend_timeline",
        description: "Extend one goal's rough date",
        yearsImpact: 0,
      },
    ],
  };
}
