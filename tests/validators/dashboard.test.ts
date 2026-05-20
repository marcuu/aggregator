import { describe, expect, it } from "vitest";

import { DashboardResponseSchema } from "@/lib/validators/dashboard";

const validResponse = {
  profile: { sector: "law", trajectory_tier: "fast" },
  scores: {
    spending: 72,
    growth: 81,
    borrowing: 44,
    spendingDelta: 3,
    growthDelta: -2,
    borrowingDelta: 0,
  },
  goals: [
    {
      goal: {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "11111111-1111-4111-8111-111111111111",
        type: "home",
        target_amount: 320000,
        target_region: "Manchester",
        deposit_pct: 15,
        rough_target_date: null,
        saved_amount: 12000,
        is_active: true,
      },
      trajectory: {
        trajectoryAge: 28.4,
        monthlySurplus: 45000,
        savedAmount: 1200000,
        monthsToGoal: 41,
        cohortPercentile: null,
      },
    },
  ],
  actions: [
    {
      id: "open_lisa",
      name: "Open a Lifetime ISA",
      description: "Free money from the government.",
      yearsImpact: -1.2,
      effort: "low",
      affiliateId: "moneybox_lisa",
      applicableTo: "home",
    },
  ],
  actionsTotal: 4,
  collision: null,
  snapshots: [
    {
      goal_id: "22222222-2222-4222-8222-222222222222",
      snapshot_date: "2026-05-11",
      trajectory_age: 28.6,
    },
  ],
  promptCards: [
    {
      id: "abc123",
      source: "goal",
      observation: "Test observation",
      seedMessage: "Test seed",
    },
  ],
  institutionCount: 1,
  truelayerExpired: false,
};

describe("DashboardResponseSchema", () => {
  it("accepts a well-formed dashboard payload", () => {
    expect(DashboardResponseSchema.safeParse(validResponse).success).toBe(true);
  });

  it("accepts a populated collision block", () => {
    const result = DashboardResponseSchema.safeParse({
      ...validResponse,
      collision: {
        collides: true,
        overlapMonths: 18,
        resolutionOptions: [
          { id: "sequence", description: "Sequence goals", yearsImpact: 0 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown sector", () => {
    expect(
      DashboardResponseSchema.safeParse({
        ...validResponse,
        profile: { sector: "medicine", trajectory_tier: "fast" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown action effort", () => {
    expect(
      DashboardResponseSchema.safeParse({
        ...validResponse,
        actions: [{ ...validResponse.actions[0], effort: "extreme" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a missing scores block", () => {
    const { scores: _scores, ...withoutScores } = validResponse;
    void _scores;
    expect(DashboardResponseSchema.safeParse(withoutScores).success).toBe(false);
  });
});
