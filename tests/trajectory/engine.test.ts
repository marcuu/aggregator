import { describe, expect, it } from "vitest";

import { ageAtDate, calculateTrajectoryAge } from "@/lib/trajectory/engine";
import type { Transaction } from "@/lib/trajectory/types";
import {
  lawFastBenchmarks,
  makeGoal,
  makeProfile,
} from "./fixtures";

const AS_OF = new Date("2026-05-18T00:00:00Z");

/**
 * Three monthly income credits and three monthly spend debits inside the
 * 90-day window. surplus = (income - spend) / 3 months.
 */
function monthlyTransactions(
  incomePence: number,
  spendPence: number,
): Transaction[] {
  const dates = ["2026-03-01", "2026-04-01", "2026-05-01"];
  return dates.flatMap((date, i) => [
    {
      id: `inc-${i}`,
      amount: incomePence,
      date,
      category: "salary",
      description: "salary",
    },
    {
      id: `spend-${i}`,
      amount: -spendPence,
      date,
      category: "rent",
      description: "rent",
    },
  ]);
}

describe("calculateTrajectoryAge", () => {
  it("returns ~28.4 for the canonical case (25yo, £40k, fast-track law, £22k deposit)", () => {
    // income £3,000/mo, spend £2,550/mo => £450/mo surplus.
    const transactions = monthlyTransactions(300_000, 255_000);
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal(),
      transactions,
      lawFastBenchmarks,
      AS_OF,
    );

    expect(result.trajectoryAge).toBeCloseTo(28.4, 1);
    expect(result.monthsToGoal).toBe(41);
    expect(result.monthlySurplus).toBe(45_000);
  });

  it("handles zero surplus without crashing — caps at the 30-year horizon", () => {
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal(),
      [],
      lawFastBenchmarks,
      AS_OF,
    );

    expect(result.monthlySurplus).toBe(0);
    expect(result.monthsToGoal).toBe(360);
    expect(Number.isFinite(result.trajectoryAge)).toBe(true);
  });

  it("handles negative surplus — spending exceeds income", () => {
    // income £2,000/mo, spend £3,000/mo => -£1,000/mo.
    const transactions = monthlyTransactions(200_000, 300_000);
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal(),
      transactions,
      lawFastBenchmarks,
      AS_OF,
    );

    expect(result.monthlySurplus).toBeLessThan(0);
    expect(result.monthsToGoal).toBe(360);
  });

  it("returns the current age when the goal is already met", () => {
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal({ saved_amount: 2_200_000 }),
      monthlyTransactions(300_000, 255_000),
      lawFastBenchmarks,
      AS_OF,
    );

    expect(result.monthsToGoal).toBe(0);
    expect(result.trajectoryAge).toBeCloseTo(25.0, 1);
  });

  it("uses the deposit fraction for a home goal with a deposit percentage", () => {
    // target £400k property, 10% deposit => £40k goal.
    const withPct = calculateTrajectoryAge(
      makeProfile(),
      makeGoal({ target_amount: 40_000_000, deposit_pct: 10 }),
      monthlyTransactions(300_000, 255_000),
      lawFastBenchmarks,
      AS_OF,
    );
    const direct = calculateTrajectoryAge(
      makeProfile(),
      makeGoal({ target_amount: 4_000_000, deposit_pct: null }),
      monthlyTransactions(300_000, 255_000),
      lawFastBenchmarks,
      AS_OF,
    );

    expect(withPct.monthsToGoal).toBe(direct.monthsToGoal);
  });

  it("honours a rough_target_date that pushes completion past the projection", () => {
    // Projection alone would land at 41 months; user has parked the goal for
    // ~5 years out — that later date is what actually competes for surplus.
    const transactions = monthlyTransactions(300_000, 255_000);
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal({ rough_target_date: "2031-05-18" }),
      transactions,
      lawFastBenchmarks,
      AS_OF,
    );

    expect(result.monthsToGoal).toBe(60);
    expect(result.trajectoryAge).toBeCloseTo(30.0, 1);
  });

  it("ignores a rough_target_date that is earlier than the projection", () => {
    const transactions = monthlyTransactions(300_000, 255_000);
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal({ rough_target_date: "2026-11-18" }),
      transactions,
      lawFastBenchmarks,
      AS_OF,
    );

    expect(result.monthsToGoal).toBe(41);
  });

  it("does not crash when benchmarks are missing", () => {
    const result = calculateTrajectoryAge(
      makeProfile(),
      makeGoal(),
      monthlyTransactions(300_000, 255_000),
      [],
      AS_OF,
    );

    expect(Number.isFinite(result.trajectoryAge)).toBe(true);
    expect(result.monthsToGoal).toBeGreaterThan(0);
  });
});

describe("ageAtDate", () => {
  it("computes fractional age from a date of birth", () => {
    expect(ageAtDate("2001-05-18", AS_OF)).toBeCloseTo(25, 1);
  });

  it("falls back to 22 when no date of birth is set", () => {
    expect(ageAtDate(null, AS_OF)).toBe(22);
  });
});
