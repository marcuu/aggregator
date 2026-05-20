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
  /** Goal that finishes first. Only set when collides === true. */
  goalAId?: string;
  goalAType?: string;
  goalAMonthsToGoal?: number;
  /** Goal that finishes later. Only set when collides === true. */
  goalBId?: string;
  goalBType?: string;
  goalBMonthsToGoal?: number;
};

/** Goals whose completion dates fall within this gap are treated as colliding. */
const COLLISION_WINDOW_MONTHS = 24;

/**
 * Effective months until a goal completes. The user's `rough_target_date`
 * is treated as a "do not start earlier than" intent: if it falls after the
 * projected completion, the goal is parked until then and the later date is
 * what actually competes for surplus.
 */
function effectiveMonthsToGoal(
  entry: { goal: Goal; trajectory: TrajectoryResult },
  asOfDate: Date,
): number {
  const projected = entry.trajectory.monthsToGoal;
  const rough = entry.goal.rough_target_date;
  if (!rough) return projected;
  const target = new Date(rough);
  const monthsUntilRough =
    (target.getFullYear() - asOfDate.getFullYear()) * 12 +
    (target.getMonth() - asOfDate.getMonth());
  return Math.max(projected, monthsUntilRough);
}

/**
 * Detect whether two goals collide — i.e. their completion windows are close
 * enough that funding both at once strains the same surplus.
 */
export function detectCollision(
  goal1: { goal: Goal; trajectory: TrajectoryResult },
  goal2: { goal: Goal; trajectory: TrajectoryResult },
  asOfDate: Date = new Date(),
): CollisionResult {
  const months1 = effectiveMonthsToGoal(goal1, asOfDate);
  const months2 = effectiveMonthsToGoal(goal2, asOfDate);
  const diff = Math.abs(months1 - months2);

  if (diff >= COLLISION_WINDOW_MONTHS) {
    return { collides: false, overlapMonths: 0, resolutionOptions: [] };
  }

  // goalA finishes first, goalB finishes later
  const [entryA, entryB, monthsA, monthsB] =
    months1 <= months2
      ? ([goal1, goal2, months1, months2] as const)
      : ([goal2, goal1, months2, months1] as const);

  return {
    collides: true,
    overlapMonths: COLLISION_WINDOW_MONTHS - diff,
    resolutionOptions: [
      {
        id: "sequence",
        description: "Sequence goals — complete first before starting second",
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
    goalAId: entryA.goal.id,
    goalAType: entryA.goal.type,
    goalAMonthsToGoal: monthsA,
    goalBId: entryB.goal.id,
    goalBType: entryB.goal.type,
    goalBMonthsToGoal: monthsB,
  };
}
