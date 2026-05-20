import type { UserProfile } from "@/lib/validators/profile";
import type {
  Transaction,
  Scores,
  SpendingBreakdown,
  GrowthBreakdown,
  BorrowingBreakdown,
} from "./types";

const DISCRETIONARY = new Set(["dining", "entertainment", "shopping", "travel"]);
const ESSENTIAL = new Set(["rent", "utilities", "groceries", "transport"]);
const INVESTMENT = new Set(["savings_transfer", "investment", "pension"]);

/**
 * The three home-screen scores, each 0-100.
 *
 * Each macro score is the unweighted average of 4 sub-scores (0-100 each).
 * Pass `currentBalancePence` to unlock the emergency-buffer and
 * debt-to-balance sub-scores; omit it and those two default to 50 (neutral).
 */
export function calculateScores(
  profile: UserProfile,
  transactions: Transaction[],
  previousScores: Scores | null,
  currentBalancePence?: number,
): Scores {
  void profile;

  const spendingBreakdown = buildSpendingBreakdown(transactions);
  const growthBreakdown = buildGrowthBreakdown(transactions, currentBalancePence);
  const borrowingBreakdown = buildBorrowingBreakdown(transactions, currentBalancePence);

  const spending = avg4(...Object.values(spendingBreakdown) as [number, number, number, number]);
  const growth = avg4(...Object.values(growthBreakdown) as [number, number, number, number]);
  const borrowing = avg4(...Object.values(borrowingBreakdown) as [number, number, number, number]);

  return {
    spending,
    growth,
    borrowing,
    spendingDelta: previousScores ? spending - previousScores.spending : 0,
    growthDelta: previousScores ? growth - previousScores.growth : 0,
    borrowingDelta: previousScores ? borrowing - previousScores.borrowing : 0,
    spendingBreakdown,
    growthBreakdown,
    borrowingBreakdown,
  };
}

// ── Spending ──────────────────────────────────────────────────────────────────

function buildSpendingBreakdown(transactions: Transaction[]): SpendingBreakdown {
  return {
    essentialRatio: essentialRatioScore(transactions),
    discretionaryRatio: discretionaryRatioScore(transactions),
    consistency: consistencyScore(transactions),
    velocity: velocityScore(transactions),
  };
}

/** Essential spend (rent, utilities, groceries, transport) ≤50% of income → 100. */
function essentialRatioScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 50;
  const essential = transactions
    .filter((t) => t.amount < 0 && ESSENTIAL.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return clamp(100 - Math.max(0, (essential / income - 0.5) / 0.5) * 100);
}

/** Discretionary spend ≤30% of income → 100; ≥60% → 0. */
function discretionaryRatioScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 50;
  const disc = transactions
    .filter((t) => t.amount < 0 && DISCRETIONARY.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return clamp(100 - Math.max(0, (disc / income - 0.3) / 0.3) * 100);
}

/** Low coefficient of variation in monthly total spend → high score. */
function consistencyScore(transactions: Transaction[]): number {
  const byMonth = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount < 0 && t.category !== "transfer") {
      const key = t.date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Math.abs(t.amount));
    }
  }
  const values = [...byMonth.values()];
  if (values.length < 2) return 50;
  return clamp(100 - cv(values) * 200);
}

/**
 * Even spread of discretionary spend across the 4 weeks of the prior complete
 * month. Fewer than 4 qualifying transactions defaults to 50 (insufficient data).
 */
function velocityScore(transactions: Transaction[]): number {
  const prevMonth = previousMonthKey();
  const monthTxs = transactions.filter(
    (t) =>
      t.amount < 0 &&
      DISCRETIONARY.has(t.category) &&
      t.date.slice(0, 7) === prevMonth,
  );
  if (monthTxs.length < 4) return 50;

  const weekly = [0, 0, 0, 0];
  for (const t of monthTxs) {
    const day = parseInt(t.date.slice(8, 10), 10);
    weekly[Math.min(Math.floor((day - 1) / 7), 3)] += Math.abs(t.amount);
  }
  return clamp(100 - cv(weekly) * 150);
}

// ── Growth ────────────────────────────────────────────────────────────────────

function buildGrowthBreakdown(
  transactions: Transaction[],
  currentBalancePence?: number,
): GrowthBreakdown {
  return {
    savingsRate: savingsRateScore(transactions),
    savingsTrend: savingsTrendScore(transactions),
    emergencyBuffer: emergencyBufferScore(transactions, currentBalancePence),
    investmentAllocation: investmentAllocationScore(transactions),
  };
}

/** Savings rate ≥20% → 100; 0% → 0. */
function savingsRateScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 0;
  return clamp(((income - totalSpend(transactions)) / income / 0.2) * 100);
}

/** Improving savings rate over the last two 30-day windows → >50. */
function savingsTrendScore(transactions: Transaction[]): number {
  const { recent, prev } = splitWindows(transactions);
  const rIncome = totalIncome(recent);
  const pIncome = totalIncome(prev);
  if (rIncome <= 0 || pIncome <= 0) return 50;
  const rRate = (rIncome - totalSpend(recent)) / rIncome;
  const pRate = (pIncome - totalSpend(prev)) / pIncome;
  return clamp(50 + ((rRate - pRate) / 0.1) * 50);
}

/** Liquid balance expressed as months of spend. 3 months → 100; 0 → 0. */
function emergencyBufferScore(
  transactions: Transaction[],
  currentBalancePence?: number,
): number {
  if (currentBalancePence === undefined) return 50;
  const monthlySpend = totalSpend(transactions) / 3;
  if (monthlySpend <= 0) return currentBalancePence > 0 ? 100 : 50;
  return clamp((currentBalancePence / monthlySpend / 3) * 100);
}

/** Investment / pension contributions ≥10% of income → 100. */
function investmentAllocationScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 0;
  const invested = transactions
    .filter((t) => t.amount < 0 && INVESTMENT.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  return clamp((invested / income / 0.1) * 100);
}

// ── Borrowing ─────────────────────────────────────────────────────────────────

function buildBorrowingBreakdown(
  transactions: Transaction[],
  currentBalancePence?: number,
): BorrowingBreakdown {
  return {
    debtServiceRatio: debtServiceRatioScore(transactions),
    debtTrajectory: debtTrajectoryScore(transactions),
    repaymentConsistency: repaymentConsistencyScore(transactions),
    debtToBalance: debtToBalanceScore(transactions, currentBalancePence),
  };
}

/** Loan repayments / income ≤0% → 100; ≥20% → 0. */
function debtServiceRatioScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 50;
  return clamp(100 - (totalRepayments(transactions) / income / 0.2) * 100);
}

/**
 * Improving debt service ratio over the last two 30-day windows → >50.
 * No loans ever detected → 100 (nothing to improve on).
 */
function debtTrajectoryScore(transactions: Transaction[]): number {
  if (!hasRepayments(transactions)) return 100;
  const { recent, prev } = splitWindows(transactions);
  const rIncome = totalIncome(recent);
  const pIncome = totalIncome(prev);
  if (rIncome <= 0 || pIncome <= 0) return 50;
  const rRatio = totalRepayments(recent) / rIncome;
  const pRatio = totalRepayments(prev) / pIncome;
  return clamp(50 + ((pRatio - rRatio) / 0.05) * 50);
}

/** Fraction of the last 3 calendar months that contained a loan repayment. */
function repaymentConsistencyScore(transactions: Transaction[]): number {
  if (!hasRepayments(transactions)) return 100;
  const now = new Date();
  const months = [0, 1, 2].map((i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });
  const covered = months.filter((m) =>
    transactions.some(
      (t) => t.amount < 0 && t.category === "loan_repayment" && t.date.slice(0, 7) === m,
    ),
  ).length;
  return clamp((covered / 3) * 100);
}

/** Monthly repayments / liquid balance. No repayments → 100. */
function debtToBalanceScore(
  transactions: Transaction[],
  currentBalancePence?: number,
): number {
  const repayments = totalRepayments(transactions);
  if (repayments === 0) return 100;
  if (!currentBalancePence || currentBalancePence <= 0) return 50;
  const monthlyRepayments = repayments / 3;
  return clamp(100 - (monthlyRepayments / currentBalancePence / 0.5) * 100);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function splitWindows(transactions: Transaction[]): {
  recent: Transaction[];
  prev: Transaction[];
} {
  const now = Date.now();
  return {
    recent: transactions.filter((t) => now - new Date(t.date).getTime() < 30 * DAY_MS),
    prev: transactions.filter((t) => {
      const age = now - new Date(t.date).getTime();
      return age >= 30 * DAY_MS && age < 60 * DAY_MS;
    }),
  };
}

function previousMonthKey(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().slice(0, 7);
}

/** Population coefficient of variation. Returns 0 when mean is 0. */
function cv(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function avg4(a: number, b: number, c: number, d: number): number {
  return clamp((a + b + c + d) / 4);
}

function hasRepayments(transactions: Transaction[]): boolean {
  return transactions.some((t) => t.amount < 0 && t.category === "loan_repayment");
}

function totalRepayments(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount < 0 && t.category === "loan_repayment")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

function totalIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount > 0 && t.category !== "transfer")
    .reduce((s, t) => s + t.amount, 0);
}

function totalSpend(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount < 0 && t.category !== "transfer")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
