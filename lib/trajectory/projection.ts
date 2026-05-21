/**
 * The single projection kernel.
 *
 * Before this module existed, `engine.ts` projected one goal at a time as
 * if it owned 100% of the monthly surplus, while `timeline.ts` ran a
 * parallel loop that funded a single pot but withdrew each goal's full
 * target at its independently-optimistic month. Per-goal dashboard ages,
 * the timeline chart, and the collision detector therefore disagreed with
 * each other in ways that compounded.
 *
 * `project` is the one place that simulates time. It accepts every active
 * goal at once, applies an explicit surplus-allocation policy (sequential
 * by default — finish one goal before funding the next), and emits both
 * the per-goal `monthsToGoal` numbers and a month-by-month series. Every
 * caller — the dashboard route, the trajectory chart, the snapshot cron,
 * the reveal screen — reads from the same projection so they cannot drift
 * apart.
 *
 * Money is integer pence end-to-end. The current_salary on profile is
 * whole pounds and is multiplied by 100 only when surplus scaling needs
 * a ratio (the ratio is unitless, so the conversion cancels — kept inline
 * to avoid hidden inflation).
 */

import type { UserProfile } from "@/lib/validators/profile";
import type { Goal, GoalType } from "@/lib/validators/goals";
import { projectSalary, type BenchmarkRow } from "./benchmarks";

/** Conservative blended cash ISA / LISA rate. */
const SAVINGS_INTEREST_RATE = 0.045;

/** Hard horizon. A user with no surplus must still return a finite result. */
const MAX_MONTHS = 30 * 12;

const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

/**
 * Order goals fund in when `allocation === "sequential"`. Home first
 * because it's the largest and most time-sensitive; emergency fund
 * second to give downside protection; then wedding; then investing.
 */
const SEQUENTIAL_PRIORITY: Record<GoalType, number> = {
  home: 0,
  emergency_fund: 1,
  wedding: 2,
  invest_start: 3,
};

export type AllocationPolicy = "sequential" | "split";

/** All monetary fields below are integer pence. */
export type ProjectionInputs = {
  profile: UserProfile;
  /**
   * Each goal carries its own current saved amount (typically derived from
   * the FinancialStateService, not from `goal.saved_amount` which is a
   * stale onboarding artefact). target/saved are in pence; we do not read
   * goal.target_amount or goal.saved_amount directly here.
   */
  goals: ProjectionGoal[];
  benchmarks: BenchmarkRow[];
  monthlySurplusPence: number;
  asOfDate: Date;
  allocation?: AllocationPolicy;
  initialDebtBalancePence?: number;
  monthlyDebtRepaymentPence?: number;
  /**
   * Keep emitting series points until at least this month even after every
   * goal has completed. The timeline chart sets this so the curve always
   * has ≥10 years of headroom; the per-goal engine leaves it at 0.
   */
  minHorizonMonths?: number;
};

export type ProjectionGoal = {
  goal: Goal;
  targetPence: number;
  savedPence: number;
  /**
   * Floor month from the user's `rough_target_date` (intent). The
   * completion month never returns earlier than this even if the maths
   * says the user could already afford it.
   */
  earliestMonth: number;
};

export type GoalProjection = {
  goalId: string;
  goalType: GoalType;
  /** Month index relative to asOfDate at which the goal completes. */
  monthsToGoal: number;
  /** Same number, but ignoring `earliestMonth` (for honest intent vs prediction). */
  rawMonthsToGoal: number;
  /** Final saved-toward-goal pence at completion (== target unless capped). */
  endingSavedPence: number;
};

export type TimelinePoint = {
  month: number;
  year: number;
  age: number;
  annualSalaryPence: number;
  cumulativeSavingsPence: number;
  debtBalancePence: number;
};

export type ProjectionResult = {
  perGoal: GoalProjection[];
  /** Monthly series, length = horizon + 1 (month 0 inclusive). */
  series: TimelinePoint[];
  currentAge: number;
  monthlySurplusPence: number;
  hasDebt: boolean;
  initialDebtBalancePence: number;
};

export function project(inputs: ProjectionInputs): ProjectionResult {
  const {
    profile,
    goals,
    benchmarks,
    monthlySurplusPence,
    asOfDate,
    allocation = "sequential",
    initialDebtBalancePence = 0,
    monthlyDebtRepaymentPence = 0,
    minHorizonMonths = 0,
  } = inputs;

  const currentAge = ageAtDate(profile.date_of_birth, asOfDate);
  const startingSalary = Math.max(1, profile.current_salary);

  // Sort goals into funding order. With "sequential" this drives which goal
  // receives surplus at each step; with "split" the order does not matter.
  const orderedIndexes = goals
    .map((_, i) => i)
    .sort((a, b) => SEQUENTIAL_PRIORITY[goals[a].goal.type] - SEQUENTIAL_PRIORITY[goals[b].goal.type]);

  // Mutable per-goal balances we accumulate into.
  const balances = goals.map((g) => g.savedPence);
  const completed: { month: number; rawMonth: number }[] = goals.map((g) => {
    // A goal already met at month 0 still respects its earliestMonth floor.
    if (g.savedPence >= g.targetPence) {
      return { month: g.earliestMonth, rawMonth: 0 };
    }
    return { month: -1, rawMonth: -1 };
  });

  let salary = startingSalary;
  let debt = initialDebtBalancePence;
  const series: TimelinePoint[] = [];

  // Month 0 snapshot — cumulative savings is the sum of starting balances.
  series.push(buildPoint(0, currentAge, asOfDate, salary, sum(balances), debt));

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const ageNow = currentAge + month / 12;

    if (month % 12 === 0) {
      salary = projectSalary(
        currentAge,
        startingSalary,
        ageNow,
        profile.sector,
        profile.trajectory_tier,
        benchmarks,
      );
    }
    const salaryRatio = salary / startingSalary;
    // No intermediate rounding: currency stays in float pence during the
    // accumulation so a single-goal run matches the closed-form projection
    // exactly. Results are rounded only when surfaced.
    const surplusThisMonth = monthlySurplusPence * salaryRatio;

    // Apply monthly interest to every running goal balance.
    for (let i = 0; i < balances.length; i++) {
      if (completed[i].month === -1) {
        balances[i] = balances[i] * (1 + SAVINGS_INTEREST_RATE / 12);
      }
    }

    // Allocate this month's surplus.
    if (allocation === "sequential") {
      // Find first not-yet-completed goal in priority order; give it everything.
      let remaining = surplusThisMonth;
      for (const i of orderedIndexes) {
        if (remaining <= 0) break;
        if (completed[i].month !== -1) continue;
        const need = goals[i].targetPence - balances[i];
        const give = Math.min(need, remaining);
        balances[i] += give;
        remaining -= give;
        // Surplus stops here: sequential funds one goal at a time.
        break;
      }
    } else {
      // Split: proportional to remaining need.
      let totalNeed = 0;
      for (let i = 0; i < goals.length; i++) {
        if (completed[i].month !== -1) continue;
        totalNeed += goals[i].targetPence - balances[i];
      }
      if (totalNeed > 0) {
        for (let i = 0; i < goals.length; i++) {
          if (completed[i].month !== -1) continue;
          const need = goals[i].targetPence - balances[i];
          const share = Math.round((need / totalNeed) * surplusThisMonth);
          balances[i] += Math.min(need, share);
        }
      }
    }

    // Mark any goal that just crossed its target.
    for (let i = 0; i < goals.length; i++) {
      if (completed[i].month === -1 && balances[i] >= goals[i].targetPence) {
        const rawMonth = month;
        const effective = Math.max(rawMonth, goals[i].earliestMonth);
        completed[i] = { month: effective, rawMonth };
      }
    }

    debt = Math.max(0, debt - monthlyDebtRepaymentPence);
    series.push(buildPoint(month, ageNow, asOfDate, salary, sum(balances), debt));

    const allDone = completed.every((c) => c.month !== -1 && month >= c.month);
    if (allDone) {
      // Keep five years of headroom past the last completion, and never stop
      // before the caller's requested minimum horizon.
      const lastCompletion = completed.length
        ? Math.max(...completed.map((c) => c.month))
        : 0;
      const targetHorizon = Math.max(lastCompletion + 60, minHorizonMonths);
      if (month >= targetHorizon) break;
    }
  }

  // Any goal that never completed within the horizon settles at MAX_MONTHS.
  for (let i = 0; i < completed.length; i++) {
    if (completed[i].month === -1) {
      completed[i] = { month: MAX_MONTHS, rawMonth: MAX_MONTHS };
    }
  }

  const perGoal: GoalProjection[] = goals.map((g, i) => ({
    goalId: g.goal.id,
    goalType: g.goal.type,
    monthsToGoal: completed[i].month,
    rawMonthsToGoal: completed[i].rawMonth,
    endingSavedPence: Math.min(balances[i], g.targetPence),
  }));

  return {
    perGoal,
    series,
    currentAge,
    monthlySurplusPence,
    hasDebt: initialDebtBalancePence > 0,
    initialDebtBalancePence,
  };
}

function buildPoint(
  month: number,
  age: number,
  asOfDate: Date,
  salaryPounds: number,
  savingsPence: number,
  debtPence: number,
): TimelinePoint {
  const year =
    asOfDate.getFullYear() +
    Math.floor((asOfDate.getMonth() + month) / 12);
  return {
    month,
    year,
    age,
    // salary is whole pounds; expose pence to keep the struct unit-consistent.
    annualSalaryPence: salaryPounds * 100,
    cumulativeSavingsPence: Math.max(0, savingsPence),
    debtBalancePence: Math.max(0, debtPence),
  };
}

function sum(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

/** Age in fractional years at the given date. Falls back to 22 with no DOB. */
export function ageAtDate(dob: string | null, asOfDate: Date): number {
  if (!dob) return 22;
  const birth = new Date(dob);
  return (asOfDate.getTime() - birth.getTime()) / MS_PER_YEAR;
}

/** Earliest-month floor from a user's `rough_target_date` (intent). */
export function monthsUntil(date: string | null, asOfDate: Date): number {
  if (!date) return 0;
  const target = new Date(date);
  const months =
    (target.getFullYear() - asOfDate.getFullYear()) * 12 +
    (target.getMonth() - asOfDate.getMonth());
  return Math.max(0, months);
}

/**
 * Compute the effective target amount (in pounds, matching the DB).
 * For a home goal with a deposit_pct, the target is the deposit, not the
 * full property price.
 */
export function computeTargetAmountPounds(goal: Goal): number {
  if (goal.type === "home" && goal.deposit_pct !== null) {
    return Math.round(goal.target_amount * (goal.deposit_pct / 100));
  }
  return goal.target_amount;
}
