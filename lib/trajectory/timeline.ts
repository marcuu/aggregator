import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { Transaction } from "./types";
import { type BenchmarkRow } from "./benchmarks";
import { calculateMonthlySurplus } from "./surplus";
import {
  computeTargetAmountPounds,
  monthsUntil,
  project,
  type ProjectionGoal,
} from "./projection";

const MAX_HORIZON_MONTHS = 300; // 25 years

export type TimelinePoint = {
  month: number;
  year: number;
  age: number;
  annualSalary: number;      // pence
  cumulativeSavings: number; // pence
  debtBalance: number;       // pence
};

export type GoalMilestone = {
  goalId: string;
  goalType: string;
  label: string;
  month: number;
  year: number;
  age: number;
  amount: number; // pence — the withdrawal from savings
};

export type TrajectoryTimelineData = {
  /** One point per year from now to horizon. Month 0 is included. */
  points: TimelinePoint[];
  milestones: GoalMilestone[];
  currentAge: number;
  hasDebt: boolean;
  initialDebtBalance: number; // pence
  monthlySurplus: number;     // pence
};

const GOAL_LABELS: Record<string, string> = {
  home: "First home",
  wedding: "Wedding",
  emergency_fund: "Emergency fund",
  invest_start: "Investing",
};

function estimateMonthlyDebtRepayment(
  transactions: Transaction[],
  asOfDate: Date,
): number {
  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - 90);
  const recent = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= cutoff && d <= asOfDate;
  });
  const totalRepayments = recent
    .filter((t) => t.amount < 0 && t.category === "loan_repayment")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return Math.round(totalRepayments / 3); // 90 days ≈ 3 months
}

/**
 * Build a combined month-by-month projection across all active goals.
 *
 * Thin wrapper over the shared projection kernel. The kernel allocates the
 * single monthly surplus across goals (sequential by default), so the
 * milestone months and the savings curve are mutually consistent — goal B
 * can no longer "complete" on a month the shared pot could not fund.
 *
 * `goals` arrive with monetary fields already in pence (callers convert).
 * `savedByGoal` carries the derived saved-toward-goal amount in pence; when
 * omitted, each goal's own (pence) saved_amount is used as a fallback.
 */
export function buildTrajectoryTimeline(
  profile: UserProfile,
  goals: Goal[], // already in pence
  transactions: Transaction[],
  benchmarks: BenchmarkRow[],
  asOfDate: Date,
  savedByGoal?: Map<string, number>,
): TrajectoryTimelineData {
  const monthlySurplus = calculateMonthlySurplus(transactions, asOfDate);
  const monthlyDebtRepayment = estimateMonthlyDebtRepayment(transactions, asOfDate);
  const initialDebtBalance = monthlyDebtRepayment * 60; // assume 5y remaining term

  const projectionGoals: ProjectionGoal[] = goals.map((goal) => {
    // goal is already in pence here.
    const targetPence =
      goal.type === "home" && goal.deposit_pct !== null
        ? Math.round(goal.target_amount * (goal.deposit_pct / 100))
        : goal.target_amount;
    const savedPence = savedByGoal?.get(goal.id) ?? goal.saved_amount;
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
    initialDebtBalancePence: initialDebtBalance,
    monthlyDebtRepaymentPence: monthlyDebtRepayment,
    minHorizonMonths: 120,
  });

  const milestones: GoalMilestone[] = result.perGoal
    .filter((p) => p.monthsToGoal > 0 && p.monthsToGoal < MAX_HORIZON_MONTHS)
    .map((p) => {
      const month = p.monthsToGoal;
      const point = result.series[Math.min(month, result.series.length - 1)];
      const target = projectionGoals.find((g) => g.goal.id === p.goalId)!.targetPence;
      return {
        goalId: p.goalId,
        goalType: p.goalType,
        label: GOAL_LABELS[p.goalType] ?? p.goalType,
        month,
        year: point.year,
        age: point.age,
        amount: target,
      };
    })
    .sort((a, b) => a.month - b.month);

  // Downsample to yearly points for the API payload (month 0 + every 12th).
  const points: TimelinePoint[] = result.series
    .filter((p) => p.month % 12 === 0)
    .map((p) => ({
      month: p.month,
      year: p.year,
      age: p.age,
      annualSalary: p.annualSalaryPence,
      cumulativeSavings: p.cumulativeSavingsPence,
      debtBalance: p.debtBalancePence,
    }));

  return {
    points,
    milestones,
    currentAge: result.currentAge,
    hasDebt: result.hasDebt,
    initialDebtBalance: result.initialDebtBalancePence,
    monthlySurplus,
  };
}

export { computeTargetAmountPounds };
