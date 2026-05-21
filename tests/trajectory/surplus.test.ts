import { describe, expect, it } from "vitest";

import { calculateMonthlySurplus } from "@/lib/trajectory/surplus";
import { makeTransaction } from "./fixtures";

const AS_OF = new Date("2026-05-18T00:00:00Z");

describe("calculateMonthlySurplus", () => {
  it("returns 0 for no transactions", () => {
    expect(calculateMonthlySurplus([], AS_OF)).toBe(0);
  });

  it("assumes 20% of income is saved over the 90-day window", () => {
    // £9,000 income over 3 months => £3,000/mo income; 20% => £600/mo.
    // Spending does not affect the assumed savings amount.
    const transactions = [
      makeTransaction({ id: "i1", amount: 300_000, category: "salary", date: "2026-03-01" }),
      makeTransaction({ id: "i2", amount: 300_000, category: "salary", date: "2026-04-01" }),
      makeTransaction({ id: "i3", amount: 300_000, category: "salary", date: "2026-05-01" }),
      makeTransaction({ id: "s1", amount: -150_000, category: "rent", date: "2026-03-02" }),
      makeTransaction({ id: "s2", amount: -150_000, category: "rent", date: "2026-04-02" }),
      makeTransaction({ id: "s3", amount: -150_000, category: "rent", date: "2026-05-02" }),
    ];
    expect(calculateMonthlySurplus(transactions, AS_OF)).toBe(60_000);
  });

  it("excludes internal transfers from income", () => {
    const transactions = [
      makeTransaction({ id: "i", amount: 300_000, category: "salary", date: "2026-05-01" }),
      makeTransaction({ id: "t-in", amount: 999_999, category: "transfer", date: "2026-05-01" }),
      makeTransaction({ id: "t-out", amount: -999_999, category: "transfer", date: "2026-05-02" }),
    ];
    // Only the £3,000 salary counts: 3000 / 3 months = £1,000/mo income; 20% => £200/mo.
    expect(calculateMonthlySurplus(transactions, AS_OF)).toBe(20_000);
  });

  it("ignores spending entirely", () => {
    const transactions = [
      makeTransaction({ id: "i", amount: 100_000, category: "salary", date: "2026-05-01" }),
      makeTransaction({ id: "s", amount: -400_000, category: "shopping", date: "2026-05-02" }),
    ];
    // £100,000 income / 3 months = £33,333/mo; 20% => £6,667/mo (positive).
    expect(calculateMonthlySurplus(transactions, AS_OF)).toBe(6_667);
  });

  it("ignores transactions older than the 90-day window", () => {
    const transactions = [
      makeTransaction({ id: "old", amount: 900_000, category: "salary", date: "2025-01-01" }),
      makeTransaction({ id: "new", amount: 300_000, category: "salary", date: "2026-05-01" }),
    ];
    // Only the in-window £3,000 counts: 3000 / 3 = £1,000/mo income; 20% => £200/mo.
    expect(calculateMonthlySurplus(transactions, AS_OF)).toBe(20_000);
  });
});
