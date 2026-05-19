import { describe, expect, it } from "vitest";

import {
  EmergencyFundDetailsSchema,
  HomeDetailsSchema,
  InvestStartDetailsSchema,
  Step1Schema,
  Step2Schema,
  Step3Schema,
  WeddingDetailsSchema,
} from "@/lib/validators/onboarding";

describe("Step1Schema", () => {
  it("coerces string FormData values into a salary and sector", () => {
    const result = Step1Schema.safeParse({
      current_salary: "42000",
      sector: "law",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.current_salary).toBe(42000);
  });

  it("rejects a salary at or above the ceiling", () => {
    expect(
      Step1Schema.safeParse({ current_salary: "1000000", sector: "law" })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown sector", () => {
    expect(
      Step1Schema.safeParse({ current_salary: "42000", sector: "medicine" })
        .success,
    ).toBe(false);
  });
});

describe("Step2Schema", () => {
  it("accepts a valid trajectory tier", () => {
    expect(Step2Schema.safeParse({ trajectory_tier: "fast" }).success).toBe(
      true,
    );
  });

  it("rejects an unknown tier", () => {
    expect(Step2Schema.safeParse({ trajectory_tier: "rocket" }).success).toBe(
      false,
    );
  });
});

describe("Step3Schema", () => {
  it("accepts one or two goal types", () => {
    expect(Step3Schema.safeParse({ goal_types: ["home"] }).success).toBe(true);
    expect(
      Step3Schema.safeParse({ goal_types: ["home", "wedding"] }).success,
    ).toBe(true);
  });

  it("rejects an empty selection", () => {
    expect(Step3Schema.safeParse({ goal_types: [] }).success).toBe(false);
  });

  it("rejects more than two goals", () => {
    expect(
      Step3Schema.safeParse({
        goal_types: ["home", "wedding", "emergency_fund"],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown goal type", () => {
    expect(Step3Schema.safeParse({ goal_types: ["holiday"] }).success).toBe(
      false,
    );
  });
});

describe("goal detail schemas", () => {
  it("accepts well-formed home details", () => {
    const result = HomeDetailsSchema.safeParse({
      target_region: "Manchester",
      target_amount: "320000",
      deposit_pct: "15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a deposit percentage outside the allowed set", () => {
    expect(
      HomeDetailsSchema.safeParse({
        target_region: "Leeds",
        target_amount: "300000",
        deposit_pct: "12",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty target region", () => {
    expect(
      HomeDetailsSchema.safeParse({
        target_region: "  ",
        target_amount: "300000",
        deposit_pct: "10",
      }).success,
    ).toBe(false);
  });

  it("accepts a wedding budget and a year within range", () => {
    expect(
      WeddingDetailsSchema.safeParse({ budget: "25000", rough_year: "2029" })
        .success,
    ).toBe(true);
  });

  it("rejects a wedding year in the past", () => {
    expect(
      WeddingDetailsSchema.safeParse({ budget: "25000", rough_year: "2020" })
        .success,
    ).toBe(false);
  });

  it("accepts emergency fund runway of 3, 6 or 12 months", () => {
    for (const months of ["3", "6", "12"]) {
      expect(EmergencyFundDetailsSchema.safeParse({ months }).success).toBe(
        true,
      );
    }
  });

  it("rejects an emergency fund runway outside the allowed set", () => {
    expect(EmergencyFundDetailsSchema.safeParse({ months: "9" }).success).toBe(
      false,
    );
  });

  it("accepts an invest-start monthly contribution", () => {
    expect(
      InvestStartDetailsSchema.safeParse({ monthly_contribution: "400" })
        .success,
    ).toBe(true);
  });

  it("rejects a non-positive invest-start contribution", () => {
    expect(
      InvestStartDetailsSchema.safeParse({ monthly_contribution: "0" }).success,
    ).toBe(false);
  });
});
