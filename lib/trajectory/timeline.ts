import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { Transaction } from "./types";
import { projectSalary, type BenchmarkRow } from "./benchmarks";
import { calculateMonthlySurplus } from "./surplus";
import { ageAtDate } from "./engine";

const SAVINGS_INTEREST_RATE = 0.045;
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

function computeTargetAmount(goal: Goal): number {
  if (goal.type === "home" && goal.deposit_pct !== null) {
    return Math.round(goal.target_amount * (goal.deposit_pct / 100));
  }
  return goal.target_amount;
}

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
 * Savings accumulate from the combined starting saved_amount, grow with
 * interest + surplus (scaling with projected salary), then dip at each
 * goal's realization month. The milestone months come from individually
 * computing each goal's months-to-goal so that goal-specific saved amounts
 * are honoured.
 *
 * All monetary values are integer pence.
 */
export function buildTrajectoryTimeline(
  profile: UserProfile,
  goals: Goal[], // already in pence
  transactions: Transaction[],
  benchmarks: BenchmarkRow[],
  asOfDate: Date,
): TrajectoryTimelineData {
  const currentAge = ageAtDate(profile.date_of_birth, asOfDate);
  const monthlySurplus = calculateMonthlySurplus(transactions, asOfDate);

  // Compute months-to-goal for each goal independently (mirrors engine.ts).
  const goalMeta = goals.map((goal) => {
    const target = computeTargetAmount(goal);
    const saved = goal.saved_amount;
    if (target - saved <= 0) return { goal, monthsToGoal: 0 };

    let running = saved;
    let months = 0;
    let salary = profile.current_salary;
    while (running < target && months < MAX_HORIZON_MONTHS) {
      months += 1;
      const ageNow = currentAge + months / 12;
      if (months % 12 === 0) {
        salary = projectSalary(
          currentAge,
          profile.current_salary,
          ageNow,
          profile.sector,
          profile.trajectory_tier,
          benchmarks,
        );
      }
      const surplus = monthlySurplus * (salary / Math.max(1, profile.current_salary));
      running = running * (1 + SAVINGS_INTEREST_RATE / 12) + surplus;
    }
    return { goal, monthsToGoal: months };
  });

  // Build milestones sorted by realization month.
  const milestones: GoalMilestone[] = goalMeta
    .filter((m) => m.monthsToGoal > 0)
    .sort((a, b) => a.monthsToGoal - b.monthsToGoal)
    .map((m) => {
      const month = m.monthsToGoal;
      const age = currentAge + month / 12;
      const year =
        asOfDate.getFullYear() +
        Math.floor((asOfDate.getMonth() + month) / 12);
      return {
        goalId: m.goal.id,
        goalType: m.goal.type,
        label: GOAL_LABELS[m.goal.type] ?? m.goal.type,
        month,
        year,
        age,
        amount: computeTargetAmount(m.goal),
      };
    });

  // Debt estimation (personal loan / credit card, not mortgage).
  const monthlyDebtRepayment = estimateMonthlyDebtRepayment(transactions, asOfDate);
  // Assume 5-year remaining term if repayments detected.
  const initialDebtBalance = monthlyDebtRepayment * 60;

  // Determine horizon: last goal + 5 years, minimum 10 years.
  const lastMilestoneMonth = milestones.length
    ? milestones[milestones.length - 1].month
    : 0;
  const horizonMonths = Math.min(
    Math.max(lastMilestoneMonth + 60, 120),
    MAX_HORIZON_MONTHS,
  );

  // Build a milestone withdrawal map.
  const withdrawalByMonth = new Map<number, number>();
  for (const m of milestones) {
    withdrawalByMonth.set(m.month, (withdrawalByMonth.get(m.month) ?? 0) + m.amount);
  }

  // Combined savings pot starts at the sum of all goals' saved amounts.
  let savings = goals.reduce((s, g) => s + g.saved_amount, 0);
  let debt = initialDebtBalance;
  let salary = profile.current_salary;

  const allPoints: TimelinePoint[] = [];

  for (let month = 0; month <= horizonMonths; month++) {
    const ageNow = currentAge + month / 12;
    const year =
      asOfDate.getFullYear() +
      Math.floor((asOfDate.getMonth() + month) / 12);

    if (month > 0) {
      // Update salary annually.
      if (month % 12 === 0) {
        salary = projectSalary(
          currentAge,
          profile.current_salary,
          ageNow,
          profile.sector,
          profile.trajectory_tier,
          benchmarks,
        );
      }
      const salaryRatio = profile.current_salary > 0
        ? salary / profile.current_salary
        : 1;
      const surplus = monthlySurplus * salaryRatio;
      savings = savings * (1 + SAVINGS_INTEREST_RATE / 12) + surplus;

      // Goal realisation — withdraw from savings pot.
      const withdrawal = withdrawalByMonth.get(month) ?? 0;
      if (withdrawal > 0) savings = Math.max(0, savings - withdrawal);

      // Debt paydown.
      debt = Math.max(0, debt - monthlyDebtRepayment);
    }

    allPoints.push({
      month,
      year,
      age: ageNow,
      // current_salary is annual pounds; multiply by 100 to store as pence
      // so all monetary fields in this struct share the same unit.
      annualSalary: salary * 100,
      cumulativeSavings: Math.max(0, savings),
      debtBalance: Math.max(0, debt),
    });
  }

  // Downsample to yearly points to keep the API payload manageable.
  // Always include month 0 (current) and every 12th month.
  const points = allPoints.filter((p) => p.month % 12 === 0);

  return {
    points,
    milestones,
    currentAge,
    hasDebt: initialDebtBalance > 0,
    initialDebtBalance,
    monthlySurplus,
  };
}
