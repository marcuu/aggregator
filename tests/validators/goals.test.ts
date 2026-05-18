import { describe, expect, it } from "vitest";

import {
  GoalInsertSchema,
  GoalSchema,
  GoalTypeSchema,
} from "@/lib/validators/goals";

const validGoal = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  type: "home",
  target_amount: 320000,
  target_region: "Manchester",
  deposit_pct: 15,
  rough_target_date: "2029-09-01",
  saved_amount: 12000,
  is_active: true,
};

describe("GoalSchema", () => {
  it("accepts a well-formed goal", () => {
    expect(GoalSchema.safeParse(validGoal).success).toBe(true);
  });

  it("accepts null optional fields", () => {
    const result = GoalSchema.safeParse({
      ...validGoal,
      type: "emergency_fund",
      target_region: null,
      deposit_pct: null,
      rough_target_date: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown goal type", () => {
    expect(
      GoalSchema.safeParse({ ...validGoal, type: "holiday" }).success,
    ).toBe(false);
  });

  it("rejects a non-positive target amount", () => {
    expect(
      GoalSchema.safeParse({ ...validGoal, target_amount: 0 }).success,
    ).toBe(false);
  });

  it("rejects a deposit percentage below 5", () => {
    expect(
      GoalSchema.safeParse({ ...validGoal, deposit_pct: 4 }).success,
    ).toBe(false);
  });

  it("rejects a deposit percentage above 50", () => {
    expect(
      GoalSchema.safeParse({ ...validGoal, deposit_pct: 51 }).success,
    ).toBe(false);
  });

  it("rejects a negative saved amount", () => {
    expect(
      GoalSchema.safeParse({ ...validGoal, saved_amount: -1 }).success,
    ).toBe(false);
  });

  it("accepts a zero saved amount", () => {
    expect(
      GoalSchema.safeParse({ ...validGoal, saved_amount: 0 }).success,
    ).toBe(true);
  });

  it("rejects a malformed target date", () => {
    expect(
      GoalSchema.safeParse({
        ...validGoal,
        rough_target_date: "2029/09/01",
      }).success,
    ).toBe(false);
  });
});

describe("GoalInsertSchema", () => {
  it("accepts an insert without id, user_id, saved_amount or is_active", () => {
    const result = GoalInsertSchema.safeParse({
      type: "wedding",
      target_amount: 25000,
      target_region: null,
      deposit_pct: null,
      rough_target_date: "2028-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("still rejects an invalid target amount on insert", () => {
    const result = GoalInsertSchema.safeParse({
      type: "wedding",
      target_amount: -5,
      target_region: null,
      deposit_pct: null,
      rough_target_date: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("GoalTypeSchema", () => {
  it("enumerates the four goal types", () => {
    expect(GoalTypeSchema.options).toEqual([
      "home",
      "wedding",
      "emergency_fund",
      "invest_start",
    ]);
  });
});
