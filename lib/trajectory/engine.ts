import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { Transaction, TrajectoryResult } from "./types";
import { calculateCohortPercentile, type BenchmarkRow } from "./benchmarks";
import { calculateMonthlySurplus } from "./surplus";
import {
  ageAtDate,
  computeTargetAmountPounds,
  monthsUntil,
  project,
} from "./projection";

export { ageAtDate } from "./projection";

/**
 * Project the age at which a single goal is met.
 *
 * Thin wrapper over the shared projection kernel (`project`) so the
 * dashboard, reveal screen and onboarding all run identical maths. The goal
 * is passed with monetary fields already in pence — `target_amount` and
 * `saved_amount` here are pence, not the pounds stored in the DB. Callers
 * should pass the *derived* saved amount from the FinancialStateService
 * rather than the stale `goal.saved_amount` column.
 */
export function calculateTrajectoryAge(
  profile: UserProfile,
  goal: Goal,
  transactions: Transaction[],
  benchmarks: BenchmarkRow[],
  asOfDate: Date,
): TrajectoryResult {
  const monthlySurplus = calculateMonthlySurplus(transactions, asOfDate);
  const currentAge = ageAtDate(profile.date_of_birth, asOfDate);
  const cohortPercentile = calculateCohortPercentile(
    profile.current_salary,
    currentAge,
    benchmarks,
  );

  // goal here is already in pence (callers convert), so use its fields
  // directly rather than the pounds-based helper.
  const targetPence =
    goal.type === "home" && goal.deposit_pct !== null
      ? Math.round(goal.target_amount * (goal.deposit_pct / 100))
      : goal.target_amount;

  const result = project({
    profile,
    goals: [
      {
        goal,
        targetPence,
        savedPence: goal.saved_amount,
        earliestMonth: monthsUntil(goal.rough_target_date, asOfDate),
      },
    ],
    benchmarks,
    monthlySurplusPence: monthlySurplus,
    asOfDate,
    allocation: "sequential",
  });

  const months = result.perGoal[0].monthsToGoal;

  return {
    trajectoryAge: roundTo(currentAge + months / 12, 1),
    monthlySurplus,
    savedAmount: goal.saved_amount,
    monthsToGoal: months,
    cohortPercentile,
  };
}

/** Re-exported for callers that historically imported it from the engine. */
export { computeTargetAmountPounds };

function roundTo(n: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(n * factor) / factor;
}
