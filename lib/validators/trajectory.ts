import { z } from "zod";

export const TimelinePointSchema = z.object({
  month: z.number(),
  year: z.number(),
  age: z.number(),
  annualSalary: z.number(),
  cumulativeSavings: z.number(),
  debtBalance: z.number(),
});

export const GoalMilestoneSchema = z.object({
  goalId: z.string(),
  goalType: z.string(),
  label: z.string(),
  month: z.number(),
  year: z.number(),
  age: z.number(),
  amount: z.number(),
});

export const TrajectoryTimelineResponseSchema = z.object({
  points: z.array(TimelinePointSchema),
  milestones: z.array(GoalMilestoneSchema),
  currentAge: z.number(),
  hasDebt: z.boolean(),
  initialDebtBalance: z.number(),
  monthlySurplus: z.number(),
});

export type TrajectoryTimelineResponse = z.infer<typeof TrajectoryTimelineResponseSchema>;
export type TimelinePoint = z.infer<typeof TimelinePointSchema>;
export type GoalMilestone = z.infer<typeof GoalMilestoneSchema>;
