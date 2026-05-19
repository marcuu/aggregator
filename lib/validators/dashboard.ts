import { z } from "zod";

import { GoalSchema } from "./goals";
import { SectorSchema, TrajectoryTierSchema } from "./profile";

/** Response contract for GET /api/dashboard, parsed on the client. */

export const ScoresSchema = z.object({
  spending: z.number(),
  growth: z.number(),
  borrowing: z.number(),
  spendingDelta: z.number(),
  growthDelta: z.number(),
  borrowingDelta: z.number(),
});

export const TrajectoryResultSchema = z.object({
  trajectoryAge: z.number(),
  monthlySurplus: z.number(),
  savedAmount: z.number(),
  monthsToGoal: z.number(),
  cohortPercentile: z.number().nullable(),
});

export const ActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  yearsImpact: z.number(),
  effort: z.enum(["low", "medium", "high"]),
  affiliateId: z.string().nullable(),
  applicableTo: z.enum(["all", "home", "wedding", "emergency_fund", "invest_start"]),
});

export const ResolutionOptionSchema = z.object({
  id: z.string(),
  description: z.string(),
  yearsImpact: z.number(),
});

export const CollisionResultSchema = z.object({
  collides: z.boolean(),
  overlapMonths: z.number(),
  resolutionOptions: z.array(ResolutionOptionSchema),
});

export const SnapshotSchema = z.object({
  goal_id: z.string(),
  snapshot_date: z.string(),
  trajectory_age: z.number(),
});

export const GoalTrajectorySchema = z.object({
  goal: GoalSchema,
  trajectory: TrajectoryResultSchema,
});

export const DashboardResponseSchema = z.object({
  profile: z.object({
    sector: SectorSchema,
    trajectory_tier: TrajectoryTierSchema,
  }),
  scores: ScoresSchema,
  goals: z.array(GoalTrajectorySchema),
  actions: z.array(ActionSchema),
  actionsTotal: z.number(),
  collision: CollisionResultSchema.nullable(),
  snapshots: z.array(SnapshotSchema),
  institutionCount: z.number(),
  truelayerExpired: z.boolean(),
});

export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type GoalTrajectory = z.infer<typeof GoalTrajectorySchema>;
export type DashboardAction = z.infer<typeof ActionSchema>;
export type DashboardSnapshot = z.infer<typeof SnapshotSchema>;
export type DashboardScores = z.infer<typeof ScoresSchema>;
export type DashboardCollision = z.infer<typeof CollisionResultSchema>;
