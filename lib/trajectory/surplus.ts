import type { Transaction } from "./types";

const DAYS_LOOKBACK = 90;

/**
 * Baseline share of income assumed to be saved each month. Projecting the
 * full income - spend gap implied that every spare penny (and every future
 * pay rise) went straight into goals — effectively a ~100% savings rate.
 * We instead assume a sustainable 20% of income is saved.
 */
const BASELINE_SAVINGS_RATE = 0.2;

/**
 * Average monthly amount assumed to be saved toward goals.
 *
 * Computed as a fixed share (`BASELINE_SAVINGS_RATE`) of recent income,
 * measured over the lookback window and excluding internal transfers
 * (TrueLayer flags these as category 'transfer'). The as-of date is passed
 * in so the function stays pure.
 */
export function calculateMonthlySurplus(
  transactions: Transaction[],
  asOfDate: Date,
): number {
  if (transactions.length === 0) return 0;

  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - DAYS_LOOKBACK);

  const recent = transactions.filter((t) => {
    const d = new Date(t.date);
    return d >= cutoff && d <= asOfDate;
  });

  const netIncome = recent
    .filter((t) => t.amount > 0 && t.category !== "transfer")
    .reduce((s, t) => s + t.amount, 0);

  const months = DAYS_LOOKBACK / 30;
  return Math.round((netIncome * BASELINE_SAVINGS_RATE) / months);
}
