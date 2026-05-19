import { describe, expect, it } from "vitest";

import { calculateScores } from "@/lib/trajectory/scores";
import type { Scores, Transaction } from "@/lib/trajectory/types";
import { makeProfile, makeTransaction } from "./fixtures";

const profile = makeProfile();

function income(amount: number, category = "salary"): Transaction {
  return makeTransaction({ id: `i-${category}`, amount, category });
}
function spend(amount: number, category: string): Transaction {
  return makeTransaction({ id: `s-${category}`, amount: -amount, category });
}

describe("calculateScores", () => {
  it("clamps every score to the 0-100 range", () => {
    // Heavy discretionary spend and loan repayments push scores to the floor.
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

  it("awards a high spending score when discretionary spend is low", () => {
    const transactions = [income(300_000), spend(10_000, "dining")];
    expect(calculateScores(profile, transactions, null).spending).toBeGreaterThan(90);
  });

  it("awards a high growth score when the savings rate is strong", () => {
    const transactions = [income(300_000), spend(60_000, "rent")];
    expect(calculateScores(profile, transactions, null).growth).toBeGreaterThan(90);
  });

  it("scores borrowing at 100 when there are no loan repayments", () => {
    const transactions = [income(300_000), spend(100_000, "rent")];
    expect(calculateScores(profile, transactions, null).borrowing).toBe(100);
  });

  it("falls back to neutral defaults when there is no income", () => {
    const scores = calculateScores(profile, [], null);
    expect(scores.spending).toBe(50);
    expect(scores.growth).toBe(0);
    expect(scores.borrowing).toBe(50);
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
