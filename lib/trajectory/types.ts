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

export type SpendingBreakdown = {
  /** Essential spend (rent, utilities, groceries, transport) as % of income. Target ≤50%. */
  essentialRatio: number;
  /** Discretionary spend (dining, entertainment, shopping, travel) as % of income. Target ≤30%. */
  discretionaryRatio: number;
  /** CV of monthly total spend — rewards stable, predictable outgoings. */
  consistency: number;
  /** Evenness of discretionary spend across the 4 weeks of the prior month. */
  velocity: number;
};

export type GrowthBreakdown = {
  /** (Income − spend) / income. Target ≥20%. */
  savingsRate: number;
  /** Direction of savings rate over the last two 30-day windows. */
  savingsTrend: number;
  /** Liquid balance expressed as months of spend. Target ≥3 months. */
  emergencyBuffer: number;
  /** Investment / pension contributions as % of income. Target ≥10%. */
  investmentAllocation: number;
};

export type BorrowingBreakdown = {
  /** Loan repayments / income. Target ≤20%. */
  debtServiceRatio: number;
  /** Direction of debt service ratio over the last two 30-day windows. */
  debtTrajectory: number;
  /** Fraction of the last 3 months that contained a loan repayment. */
  repaymentConsistency: number;
  /** Monthly repayments relative to total liquid balance. */
  debtToBalance: number;
};

export type Scores = {
  spending: number;
  growth: number;
  borrowing: number;
  spendingDelta: number;
  growthDelta: number;
  borrowingDelta: number;
  spendingBreakdown?: SpendingBreakdown;
  growthBreakdown?: GrowthBreakdown;
  borrowingBreakdown?: BorrowingBreakdown;
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
