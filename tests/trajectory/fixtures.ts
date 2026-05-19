import type { UserProfile } from "@/lib/validators/profile";
import type { Goal } from "@/lib/validators/goals";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import type { Transaction } from "@/lib/trajectory/types";

export function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    sector: "law",
    trajectory_tier: "fast",
    current_salary: 40000,
    date_of_birth: "2001-05-18",
    onboarding_complete: true,
    onboarding_step: 5,
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "11111111-1111-4111-8111-111111111111",
    type: "home",
    target_amount: 2_200_000,
    target_region: "Manchester",
    deposit_pct: null,
    rough_target_date: null,
    saved_amount: 0,
    is_active: true,
    ...overrides,
  };
}

export function makeTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id: "txn",
    amount: -1000,
    date: "2026-05-01",
    category: "dining",
    description: "test",
    ...overrides,
  };
}

/** law / fast benchmark rows, ages 25-30. Only salary_p50 drives projection. */
export const lawFastBenchmarks: BenchmarkRow[] = [
  { sector: "law", tier: "fast", age: 25, salary_p25: 95400, salary_p50: 112200, salary_p75: 132400 },
  { sector: "law", tier: "fast", age: 26, salary_p25: 104700, salary_p50: 123200, salary_p75: 145400 },
  { sector: "law", tier: "fast", age: 27, salary_p25: 114100, salary_p50: 134200, salary_p75: 158400 },
  { sector: "law", tier: "fast", age: 28, salary_p25: 123400, salary_p50: 145200, salary_p75: 171300 },
  { sector: "law", tier: "fast", age: 29, salary_p25: 133300, salary_p50: 156800, salary_p75: 185000 },
  { sector: "law", tier: "fast", age: 30, salary_p25: 143100, salary_p50: 168300, salary_p75: 198600 },
];
