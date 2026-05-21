import { z } from "zod";

/**
 * Zod schemas for the goals table. A user holds at most two active goals;
 * the cap itself is enforced in the database (see 005_create_goals.sql).
 */

export const GoalTypeSchema = z.enum([
  "home",
  "wedding",
  "emergency_fund",
  "invest_start",
]);

export const GoalSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: GoalTypeSchema,
  target_amount: z.number().int().positive(),
  target_region: z.string().nullable(),
  deposit_pct: z.number().int().min(5).max(50).nullable(),
  /** User-stated target date (intent). Never overwritten by the engine. */
  rough_target_date: z.string().date().nullable(),
  /** Engine-projected completion date. Recomputed by the snapshot cron. */
  projected_target_date: z.string().date().nullable().default(null),
  saved_amount: z.number().int().nonnegative(),
  is_active: z.boolean(),
});

/**
 * Insert shape: id and user_id are assigned server-side; saved_amount and
 * is_active carry database defaults so they may be omitted.
 */
export const GoalInsertSchema = GoalSchema.omit({
  id: true,
  user_id: true,
}).partial({
  saved_amount: true,
  is_active: true,
});

export type Goal = z.infer<typeof GoalSchema>;
export type GoalInsert = z.infer<typeof GoalInsertSchema>;
export type GoalType = z.infer<typeof GoalTypeSchema>;
