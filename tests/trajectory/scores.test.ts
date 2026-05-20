import { describe, expect, it } from "vitest";

import { calculateScores } from "@/lib/trajectory/scores";
import type { Scores, Transaction } from "@/lib/trajectory/types";
import { makeProfile, makeTransaction } from "./fixtures";

const profile = makeProfile();

// All test transactions default to date "2026-05-01" (19 days before the
// test baseline of 2026-05-20), which places them inside the 30-day
// "recent" window but outside the prior month used for velocity scoring.

function income(amount: number, category = "salary"): Transaction {
  return makeTransaction({ id: `i-${category}`, amount, category });
}
function spend(amount: number, category: string): Transaction {
  return makeTransaction({ id: `s-${category}`, amount: -amount, category });
}

describe("calculateScores — macro behaviour", () => {
  it("clamps every score to the 0-100 range", () => {
    const transactions = [
      income(100_000),
      spend(500_000, "dining"),
      spend(500_000, "loan_repayment"),
    ];
    const scores = calculateScores(profile, transactions, null);
    for (const key of ["spending", "growth", "borrowing"] as const) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
      expect(scores[key]).toBeLessThanOrEqual(100);
    }
  });

  it("awards a high spending score when discretionary and essential spend are low", () => {
    // essentialRatio=100, discretionaryRatio=100; consistency+velocity default to 50
    const transactions = [income(300_000), spend(10_000, "dining")];
    expect(calculateScores(profile, transactions, null).spending).toBeGreaterThan(70);
  });

  it("awards a high growth score when savings rate and investments are strong", () => {
    const transactions = [
      income(300_000),
      spend(60_000, "rent"),
      spend(30_000, "investment"),
    ];
    // savingsRate=100, emergencyBuffer=100, investmentAllocation=100; savingsTrend=50
    expect(calculateScores(profile, transactions, null, 200_000).growth).toBeGreaterThan(80);
  });

  it("scores borrowing at 100 when there are no loan repayments", () => {
    // All 4 sub-scores return 100 when no debt is detected
    const transactions = [income(300_000), spend(100_000, "rent")];
    expect(calculateScores(profile, transactions, null).borrowing).toBe(100);
  });

  it("returns sensible defaults when there is no income or transaction data", () => {
    const scores = calculateScores(profile, [], null);
    // Spending: all 4 sub-scores default to 50 → macro = 50
    expect(scores.spending).toBe(50);
    // Growth: savingsRate=0, investmentAllocation=0, savingsTrend=50, emergencyBuffer=50 → ~25
    expect(scores.growth).toBeLessThan(35);
    // Borrowing: no debt detected → debtTrajectory/consistency/debtToBalance all 100; debtServiceRatio=50 → ~88
    expect(scores.borrowing).toBeGreaterThan(80);
  });

  it("returns zero deltas when there is no previous snapshot", () => {
    const scores = calculateScores(profile, [income(300_000)], null);
    expect(scores.spendingDelta).toBe(0);
    expect(scores.growthDelta).toBe(0);
    expect(scores.borrowingDelta).toBe(0);
  });

  it("computes deltas against the previous snapshot", () => {
    const previous: Scores = {
      spending: 50,
      growth: 40,
      borrowing: 70,
      spendingDelta: 0,
      growthDelta: 0,
      borrowingDelta: 0,
    };
    const scores = calculateScores(
      profile,
      [income(300_000), spend(10_000, "dining")],
      previous,
    );
    expect(scores.spendingDelta).toBe(scores.spending - 50);
    expect(scores.growthDelta).toBe(scores.growth - 40);
    expect(scores.borrowingDelta).toBe(scores.borrowing - 70);
  });
});

describe("calculateScores — sub-score breakdowns", () => {
  it("exposes breakdowns on all three macro scores", () => {
    const scores = calculateScores(profile, [income(300_000)], null);
    expect(scores.spendingBreakdown).toBeDefined();
    expect(scores.growthBreakdown).toBeDefined();
    expect(scores.borrowingBreakdown).toBeDefined();
  });

  describe("spending breakdown", () => {
    it("essentialRatio: ≤50% of income scores 100; ≥100% scores 0", () => {
      const atTarget = calculateScores(
        profile,
        [income(200_000), spend(100_000, "rent")],
        null,
      );
      expect(atTarget.spendingBreakdown!.essentialRatio).toBe(100);

      const over = calculateScores(
        profile,
        [income(100_000), spend(200_000, "rent")],
        null,
      );
      expect(over.spendingBreakdown!.essentialRatio).toBe(0);
    });

    it("discretionaryRatio: ≤30% of income scores 100; ≥60% scores 0", () => {
      const atTarget = calculateScores(
        profile,
        [income(300_000), spend(90_000, "dining")],
        null,
      );
      expect(atTarget.spendingBreakdown!.discretionaryRatio).toBe(100);

      const over = calculateScores(
        profile,
        [income(100_000), spend(200_000, "dining")],
        null,
      );
      expect(over.spendingBreakdown!.discretionaryRatio).toBe(0);
    });

    it("consistency defaults to 50 with fewer than 2 months of data", () => {
      const scores = calculateScores(profile, [income(300_000), spend(50_000, "rent")], null);
      expect(scores.spendingBreakdown!.consistency).toBe(50);
    });
  });

  describe("growth breakdown", () => {
    it("savingsRate: 20% savings rate scores 100", () => {
      const scores = calculateScores(
        profile,
        [income(100_000), spend(80_000, "rent")],
        null,
      );
      expect(scores.growthBreakdown!.savingsRate).toBe(100);
    });

    it("emergencyBuffer: 3 months of spend covered scores 100", () => {
      // Monthly spend = 90_000/3 = 30_000; balance = 90_000 = 3 months
      const scores = calculateScores(
        profile,
        [income(300_000), spend(90_000, "rent")],
        null,
        90_000,
      );
      expect(scores.growthBreakdown!.emergencyBuffer).toBe(100);
    });

    it("emergencyBuffer defaults to 50 when balance is not provided", () => {
      const scores = calculateScores(profile, [income(300_000)], null);
      expect(scores.growthBreakdown!.emergencyBuffer).toBe(50);
    });

    it("investmentAllocation: 10% of income to investments scores 100", () => {
      const scores = calculateScores(
        profile,
        [income(100_000), spend(10_000, "investment")],
        null,
      );
      expect(scores.growthBreakdown!.investmentAllocation).toBe(100);
    });
  });

  describe("borrowing breakdown", () => {
    it("debtServiceRatio: no repayments scores 100", () => {
      const scores = calculateScores(profile, [income(300_000)], null);
      expect(scores.borrowingBreakdown!.debtServiceRatio).toBe(100);
    });

    it("debtServiceRatio: 20% repayment ratio scores 0", () => {
      const scores = calculateScores(
        profile,
        [income(100_000), spend(20_000, "loan_repayment")],
        null,
      );
      expect(scores.borrowingBreakdown!.debtServiceRatio).toBe(0);
    });

    it("debtTrajectory scores 100 when no debt has ever been detected", () => {
      const scores = calculateScores(profile, [income(300_000), spend(50_000, "rent")], null);
      expect(scores.borrowingBreakdown!.debtTrajectory).toBe(100);
    });

    it("repaymentConsistency scores 100 when there are no loans", () => {
      const scores = calculateScores(profile, [income(300_000)], null);
      expect(scores.borrowingBreakdown!.repaymentConsistency).toBe(100);
    });

    it("debtToBalance scores 100 when there are no repayments", () => {
      const scores = calculateScores(profile, [income(300_000)], null, 500_000);
      expect(scores.borrowingBreakdown!.debtToBalance).toBe(100);
    });
  });
});
