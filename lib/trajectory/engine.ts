import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { Transaction, TrajectoryResult } from "./types";
import { calculateCohortPercentile, projectSalary, type BenchmarkRow } from "./benchmarks";
import { calculateMonthlySurplus } from "./surplus";

/** Conservative blended cash ISA / LISA rate. */
const SAVINGS_INTEREST_RATE = 0.045;

/** Sanity cap so a zero-surplus user does not loop forever. */
const MAX_MONTHS = 30 * 12;

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

/**
 * Project the age at which a goal is met.
 *
 * Pure: every date is passed in, no clock is read. Monetary inputs
 * (goal.target_amount, goal.saved_amount) and the computed surplus are all
 * integer pence so the running balance never drifts.
 */
export function calculateTrajectoryAge(
  profile: UserProfile,
  goal: Goal,
  transactions: Transaction[],
  benchmarks: BenchmarkRow[],
  asOfDate: Date,
): TrajectoryResult {
  const monthlySurplus = calculateMonthlySurplus(transactions, asOfDate);
  const savedAmount = goal.saved_amount;
  const targetAmount = computeTargetAmount(goal);
  const currentAge = ageAtDate(profile.date_of_birth, asOfDate);
  const cohortPercentile = calculateCohortPercentile(
    profile.current_salary,
    currentAge,
    benchmarks,
  );

  if (targetAmount - savedAmount <= 0) {
    const months = monthsUntilRough(goal.rough_target_date, asOfDate);
    return {
      trajectoryAge: roundTo(currentAge + months / 12, 1),
      monthlySurplus,
      savedAmount,
      monthsToGoal: months,
      cohortPercentile,
    };
  }

  let runningSaved = savedAmount;
  let monthsElapsed = 0;
  let currentSalary = profile.current_salary;

  while (runningSaved < targetAmount && monthsElapsed < MAX_MONTHS) {
    monthsElapsed += 1;
    const ageNow = currentAge + monthsElapsed / 12;

    // Re-project salary once a year; surplus scales with salary growth.
    if (monthsElapsed % 12 === 0) {
      currentSalary = projectSalary(
        currentAge,
        profile.current_salary,
        ageNow,
        profile.sector,
        profile.trajectory_tier,
        benchmarks,
      );
    }

    const surplusThisMonth =
      monthlySurplus * (currentSalary / profile.current_salary);

    runningSaved =
      runningSaved * (1 + SAVINGS_INTEREST_RATE / 12) + surplusThisMonth;
  }

  // Honour the user's rough_target_date as a "do not start earlier than" intent.
  // If they parked the goal further out, that's when it actually completes.
  const effectiveMonths = Math.max(
    monthsElapsed,
    monthsUntilRough(goal.rough_target_date, asOfDate),
  );

  return {
    trajectoryAge: roundTo(currentAge + effectiveMonths / 12, 1),
    monthlySurplus,
    savedAmount,
    monthsToGoal: effectiveMonths,
    cohortPercentile,
  };
}

function monthsUntilRough(rough: string | null, asOfDate: Date): number {
  if (!rough) return 0;
  const target = new Date(rough);
  const months =
    (target.getFullYear() - asOfDate.getFullYear()) * 12 +
    (target.getMonth() - asOfDate.getMonth());
  return Math.max(0, months);
}

/** Age in fractional years at the given date. Falls back to 22 with no DOB. */
export function ageAtDate(dob: string | null, asOfDate: Date): number {
  if (!dob) return 22;
  const birth = new Date(dob);
  return (asOfDate.getTime() - birth.getTime()) / MS_PER_YEAR;
}

/** For a home goal the target is the deposit; other goals target the full sum. */
function computeTargetAmount(goal: Goal): number {
  if (goal.type === "home" && goal.deposit_pct !== null) {
    return Math.round(goal.target_amount * (goal.deposit_pct / 100));
  }
  return goal.target_amount;
}

function roundTo(n: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(n * factor) / factor;
}
