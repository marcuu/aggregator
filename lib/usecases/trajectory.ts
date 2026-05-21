/**
 * Orchestration layer between the routes and the pure projection kernel.
 *
 * Routes stay thin: they authenticate, load rows, and call into here. This
 * module owns the "run one allocated projection for all of a user's goals
 * and shape the per-goal results" use-case so the dashboard, the collision
 * detector and the snapshot cron all see the same numbers — the multi-goal
 * surplus double-counting bug came from each computing goals in isolation.
 */

import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import type { Transaction, TrajectoryResult } from "@/lib/trajectory/types";
import { calculateMonthlySurplus } from "@/lib/trajectory/surplus";
import { calculateCohortPercentile } from "@/lib/trajectory/benchmarks";
import {
  ageAtDate,
  monthsUntil,
  project,
  type ProjectionGoal,
} from "@/lib/trajectory/projection";

export type GoalTrajectoryEntry = {
  goal: Goal;
  trajectory: TrajectoryResult;
};

/**
 * Project every active goal in a single allocated run.
 *
 * `goals` are in pounds (as stored). `savedByGoal` carries the derived
 * saved-toward-goal amount in pence from the FinancialStateService; goals
 * absent from the map fall back to 0 (never the stale saved_amount column).
 */
export function projectUserGoals(params: {
  profile: UserProfile;
  goals: Goal[];
  transactions: Transaction[];
  benchmarks: BenchmarkRow[];
  savedByGoal: Map<string, number>;
  asOfDate: Date;
}): GoalTrajectoryEntry[] {
  const { profile, goals, transactions, benchmarks, savedByGoal, asOfDate } =
    params;

  const monthlySurplus = calculateMonthlySurplus(transactions, asOfDate);
  const currentAge = ageAtDate(profile.date_of_birth, asOfDate);
  const cohortPercentile = calculateCohortPercentile(
    profile.current_salary,
    currentAge,
    benchmarks,
  );

  const projectionGoals: ProjectionGoal[] = goals.map((goal) => {
    const targetPence = computeTargetPence(goal);
    const savedPence = savedByGoal.get(goal.id) ?? 0;
    return {
      goal,
      targetPence,
      savedPence,
      earliestMonth: monthsUntil(goal.rough_target_date, asOfDate),
    };
  });

  const result = project({
    profile,
    goals: projectionGoals,
    benchmarks,
    monthlySurplusPence: monthlySurplus,
    asOfDate,
    allocation: "sequential",
  });

  return goals.map((goal) => {
    const p = result.perGoal.find((g) => g.goalId === goal.id)!;
    const saved = savedByGoal.get(goal.id) ?? 0;
    return {
      goal,
      trajectory: {
        trajectoryAge: round1(currentAge + p.monthsToGoal / 12),
        monthlySurplus,
        savedAmount: saved,
        monthsToGoal: p.monthsToGoal,
        cohortPercentile,
      },
    };
  });
}

/**
 * Project each goal *in isolation* (as if it owned 100% of the surplus).
 *
 * The collision detector uses these solo windows to decide whether two
 * goals naturally compete for the same surplus — under the allocated
 * projection they are already serialised, so their allocated completion
 * dates never overlap and could never be flagged. The displayed per-goal
 * ages still come from `projectUserGoals` (allocated); only collision
 * detection consults the solo windows.
 */
export function projectUserGoalsSolo(params: {
  profile: UserProfile;
  goals: Goal[];
  transactions: Transaction[];
  benchmarks: BenchmarkRow[];
  savedByGoal: Map<string, number>;
  asOfDate: Date;
}): GoalTrajectoryEntry[] {
  return params.goals.map(
    (goal) => projectUserGoals({ ...params, goals: [goal] })[0],
  );
}

/** Target in pence; goal.target_amount is whole pounds. */
function computeTargetPence(goal: Goal): number {
  const pounds =
    goal.type === "home" && goal.deposit_pct !== null
      ? Math.round(goal.target_amount * (goal.deposit_pct / 100))
      : goal.target_amount;
  return pounds * 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
