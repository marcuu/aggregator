import { describe, expect, it } from "vitest";

import {
  SectorSchema,
  TrajectoryTierSchema,
  UserProfileInsertSchema,
  UserProfileSchema,
} from "@/lib/validators/profile";

const validProfile = {
  user_id: "11111111-1111-4111-8111-111111111111",
  sector: "law",
  trajectory_tier: "fast",
  current_salary: 42000,
  date_of_birth: "2001-03-14",
  onboarding_complete: false,
  onboarding_step: 3,
};

describe("UserProfileSchema", () => {
  it("accepts a well-formed profile", () => {
    expect(UserProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it("accepts a null date of birth", () => {
    const result = UserProfileSchema.safeParse({
      ...validProfile,
      date_of_birth: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown sector", () => {
    const result = UserProfileSchema.safeParse({
      ...validProfile,
      sector: "medicine",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown trajectory tier", () => {
    const result = UserProfileSchema.safeParse({
      ...validProfile,
      trajectory_tier: "rocket",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive salary", () => {
    expect(
      UserProfileSchema.safeParse({ ...validProfile, current_salary: 0 })
        .success,
    ).toBe(false);
  });

  it("rejects a salary at or above the 1,000,000 ceiling", () => {
    expect(
      UserProfileSchema.safeParse({ ...validProfile, current_salary: 1000000 })
        .success,
    ).toBe(false);
  });

  it("rejects a non-integer salary", () => {
    expect(
      UserProfileSchema.safeParse({ ...validProfile, current_salary: 42000.5 })
        .success,
    ).toBe(false);
  });

  it("rejects an onboarding step outside 1-5", () => {
    expect(
      UserProfileSchema.safeParse({ ...validProfile, onboarding_step: 6 })
        .success,
    ).toBe(false);
  });

  it("rejects a malformed date of birth", () => {
    expect(
      UserProfileSchema.safeParse({
        ...validProfile,
        date_of_birth: "14-03-2001",
      }).success,
    ).toBe(false);
  });
});

describe("UserProfileInsertSchema", () => {
  it("accepts an insert without user_id or onboarding fields", () => {
    const result = UserProfileInsertSchema.safeParse({
      sector: "banking",
      trajectory_tier: "high",
      current_salary: 55000,
      date_of_birth: null,
    });
    expect(result.success).toBe(true);
  });

  it("still rejects an invalid sector on insert", () => {
    const result = UserProfileInsertSchema.safeParse({
      sector: "medicine",
      trajectory_tier: "high",
      current_salary: 55000,
      date_of_birth: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("SectorSchema / TrajectoryTierSchema", () => {
  it("enumerates the five sectors", () => {
    expect(SectorSchema.options).toEqual([
      "banking",
      "law",
      "stem",
      "consulting",
      "other",
    ]);
  });

  it("enumerates the three tiers", () => {
    expect(TrajectoryTierSchema.options).toEqual(["steady", "fast", "high"]);
  });
});
