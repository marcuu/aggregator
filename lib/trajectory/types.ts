/**
 * Shared types for the trajectory engine.
 *
 * Money is held as integer pence everywhere inside the engine — float maths
 * on currency produces drift. Callers convert to pounds at the render layer.
 */

export type TrajectoryResult = {
  /** Projected age the goal is met, e.g. 28.4. */
  trajectoryAge: number;
  /** Average monthly investable surplus, pence. */
  monthlySurplus: number;
  /** Amount saved towards the goal so far, pence. */
  savedAmount: number;
  /** Whole months from the as-of date until the goal is met. */
  monthsToGoal: number;
  /** Percentile within the user's cohort, or null when data is insufficient. */
  cohortPercentile: number | null;
};

export type Scores = {
  spending: number;
  growth: number;
  borrowing: number;
  spendingDelta: number;
  growthDelta: number;
  borrowingDelta: number;
};

export type ActionEffort = "low" | "medium" | "high";

export type Action = {
  id: string;
  name: string;
  description: string;
  /** Change in goal age, in years. Negative pulls the goal closer. */
  yearsImpact: number;
  effort: ActionEffort;
  affiliateId: string | null;
  applicableTo: "all" | "home" | "wedding" | "emergency_fund" | "invest_start";
};

export type Transaction = {
  id: string;
  /** Pence. Positive = credit, negative = debit. */
  amount: number;
  /** ISO date string. */
  date: string;
  /** dining, transport, salary, transfer, loan_repayment, etc. */
  category: string;
  description: string;
};
