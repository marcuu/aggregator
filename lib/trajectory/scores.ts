import type { UserProfile } from "@/lib/validators/profile";
import type { Transaction, Scores } from "./types";

/**
 * The three home-screen scores, each 0-100.
 *
 * v1 uses simple, self-contained heuristics over the supplied transactions.
 * They are deliberately uncalibrated — refine against real user data once it
 * exists, and bring cohort comparison in via `profile` then.
 */

const DISCRETIONARY = new Set(["dining", "entertainment", "shopping", "travel"]);

export function calculateScores(
  profile: UserProfile,
  transactions: Transaction[],
  previousScores: Scores | null,
): Scores {
  void profile; // reserved for cohort calibration

  const spending = calculateSpendingScore(transactions);
  const growth = calculateGrowthScore(transactions);
  const borrowing = calculateBorrowingScore(transactions);

  return {
    spending,
    growth,
    borrowing,
    spendingDelta: previousScores ? spending - previousScores.spending : 0,
    growthDelta: previousScores ? growth - previousScores.growth : 0,
    borrowingDelta: previousScores ? borrowing - previousScores.borrowing : 0,
  };
}

/** Lower discretionary spend as a share of income scores higher. */
export function calculateSpendingScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 50;

  const discretionary = transactions
    .filter((t) => t.amount < 0 && DISCRETIONARY.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return clamp(100 - (discretionary / income) * 200);
}

/** A higher savings rate scores higher. */
export function calculateGrowthScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 0;

  const spend = totalSpend(transactions);
  const savingsRate = (income - spend) / income;
  return clamp(savingsRate * 250);
}

/** A lower debt-service ratio scores higher; no debt scores 100. */
export function calculateBorrowingScore(transactions: Transaction[]): number {
  const income = totalIncome(transactions);
  if (income <= 0) return 50;

  const repayments = transactions
    .filter((t) => t.amount < 0 && t.category === "loan_repayment")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return clamp(100 - (repayments / income) * 500);
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
