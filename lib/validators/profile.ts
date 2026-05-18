import { z } from "zod";

/**
 * Zod schemas for the user_profiles table — the onboarding answers that
 * drive every trajectory projection.
 */

export const SectorSchema = z.enum([
  "banking",
  "law",
  "stem",
  "consulting",
  "other",
]);

export const TrajectoryTierSchema = z.enum(["steady", "fast", "high"]);

export const UserProfileSchema = z.object({
  user_id: z.string().uuid(),
  sector: SectorSchema,
  trajectory_tier: TrajectoryTierSchema,
  current_salary: z.number().int().positive().max(999999),
  date_of_birth: z.string().date().nullable(),
  onboarding_complete: z.boolean(),
  onboarding_step: z.number().int().min(1).max(5),
});

/**
 * Insert shape: user_id comes from the session, and the onboarding fields
 * carry database defaults so they may be omitted.
 */
export const UserProfileInsertSchema = UserProfileSchema.omit({
  user_id: true,
}).partial({
  onboarding_complete: true,
  onboarding_step: true,
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UserProfileInsert = z.infer<typeof UserProfileInsertSchema>;
export type Sector = z.infer<typeof SectorSchema>;
export type TrajectoryTier = z.infer<typeof TrajectoryTierSchema>;
