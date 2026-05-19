import { z } from "zod";

import { SectorSchema, TrajectoryTierSchema } from "./profile";
import { GoalTypeSchema } from "./goals";

/**
 * Input contracts for each onboarding step. FormData values arrive as
 * strings, so numeric fields use z.coerce.
 */

export const Step1Schema = z.object({
  current_salary: z.coerce.number().int().positive().max(999999),
  sector: SectorSchema,
});

export const Step2Schema = z.object({
  trajectory_tier: TrajectoryTierSchema,
});

export const Step3Schema = z.object({
  goal_types: z.array(GoalTypeSchema).min(1).max(2),
});

const DEPOSIT_PCT = [10, 15, 20] as const;
const RUNWAY_MONTHS = [3, 6, 12] as const;
const CURRENT_YEAR = 2026;

export const HomeDetailsSchema = z.object({
  target_region: z.string().trim().min(1).max(120),
  /** Property value in whole pounds. */
  target_amount: z.coerce.number().int().positive().max(99_999_999),
  deposit_pct: z.coerce
    .number()
    .int()
    .refine((v): v is (typeof DEPOSIT_PCT)[number] =>
      DEPOSIT_PCT.includes(v as (typeof DEPOSIT_PCT)[number]),
    ),
});

export const WeddingDetailsSchema = z.object({
  /** Budget in whole pounds. */
  budget: z.coerce.number().int().positive().max(9_999_999),
  rough_year: z.coerce
    .number()
    .int()
    .min(CURRENT_YEAR)
    .max(CURRENT_YEAR + 15),
});

export const EmergencyFundDetailsSchema = z.object({
  months: z.coerce
    .number()
    .int()
    .refine((v): v is (typeof RUNWAY_MONTHS)[number] =>
      RUNWAY_MONTHS.includes(v as (typeof RUNWAY_MONTHS)[number]),
    ),
});

export const InvestStartDetailsSchema = z.object({
  /** Intended monthly contribution in whole pounds. */
  monthly_contribution: z.coerce.number().int().positive().max(999_999),
});

export type Step1Input = z.infer<typeof Step1Schema>;
export type Step2Input = z.infer<typeof Step2Schema>;
export type Step3Input = z.infer<typeof Step3Schema>;
