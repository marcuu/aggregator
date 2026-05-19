import type { Transaction } from "./types";

const DAYS_LOOKBACK = 90;

/**
 * Average monthly investable surplus from recent transactions.
 *
 * Surplus = income - spending, both measured over the lookback window and
 * excluding internal transfers (TrueLayer flags these as category
 * 'transfer'). The as-of date is passed in so the function stays pure.
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

  const netSpend = recent
    .filter((t) => t.amount < 0 && t.category !== "transfer")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const months = DAYS_LOOKBACK / 30;
  return Math.round((netIncome - netSpend) / months);
}
