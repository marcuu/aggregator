import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import { ageAtDate, calculateTrajectoryAge } from "@/lib/trajectory/engine";
import { calculateScores } from "@/lib/trajectory/scores";
import { calculateMonthlySurplus } from "@/lib/trajectory/surplus";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { getFinancialState, attributeSavingsToGoals } from "@/lib/finance/state";
import { GoalSchema, type GoalType } from "@/lib/validators/goals";
import {
  SectorSchema,
  TrajectoryTierSchema,
  UserProfileSchema,
} from "@/lib/validators/profile";

/**
 * Everything the chat model is given about a user. Built server-side; the
 * shape is also what the system prompt formatter consumes.
 */
export type UserContext = {
  firstName: string;
  age: number | null;
  sector: string;
  tier: string;
  tierDescription: string;
  /** Whole pounds. */
  currentSalary: number;
  /** Whole pounds, recent average. */
  monthlySurplus: number;
  goals: { type: GoalType; target: number; trajectoryAge: number }[];
  scores: { spending: number; growth: number; borrowing: number };
  /** Outflow by transaction category over the last 90 days, whole pounds. */
  spendingByType: { type: string; amount: number }[];
};

const TIER_DESCRIPTION: Record<string, string> = {
  steady: "tracking the sector median",
  fast: "moving faster than most peers — top quartile",
  high: "on an exceptional path — top decile",
};

const SECTOR_LABEL: Record<string, string> = {
  banking: "Banking & finance",
  law: "Law",
  stem: "STEM",
  consulting: "Consulting",
  other: "Other",
};

const TIER_LABEL: Record<string, string> = {
  steady: "Steady",
  fast: "Fast",
  high: "High",
};

const SPENDING_WINDOW_DAYS = 90;
const TOP_SPENDING_TYPES = 5;

/**
 * Assembles every signal the chat model needs to give grounded answers.
 * Runs in parallel where possible; transactions are loaded once and reused.
 */
export async function buildUserContext(
  user: User,
  supabase: SupabaseClient<Database>,
): Promise<UserContext> {
  const [{ data: profileRow }, { data: goalRows }, { data: benchmarkRows }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("salary_benchmarks")
        .select("sector, tier, age, salary_p25, salary_p50, salary_p75"),
    ]);

  if (!profileRow) {
    throw new Error("no profile");
  }

  const profile = UserProfileSchema.parse(profileRow);
  const goals = (goalRows ?? []).map((g) => GoalSchema.parse(g));
  const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];
  const transactions = await getTransactionsForUser(user.id, supabase);
  const asOfDate = new Date();

  // Derive current saved-toward-goal from synced balances so the model is
  // told the user's real progress, not a hardcoded zero.
  const financialState = await getFinancialState(user.id, supabase, asOfDate);
  const savedByGoal = attributeSavingsToGoals(goals, financialState);

  const scores = calculateScores(profile, transactions, null);

  const goalsWithTrajectory = goals.map((goal) => {
    const trajectory = calculateTrajectoryAge(
      profile,
      // Engine works in pence; DB amounts are pounds. saved_amount comes
      // from the derived attribution, already in pence.
      {
        ...goal,
        target_amount: goal.target_amount * 100,
        saved_amount: savedByGoal.get(goal.id) ?? 0,
      },
      transactions,
      benchmarks,
      asOfDate,
    );
    return {
      type: goal.type,
      target: goal.target_amount,
      trajectoryAge: round1(trajectory.trajectoryAge),
    };
  });

  // monthlySurplus is goal-independent.
  const monthlySurplusPence = calculateMonthlySurplus(transactions, asOfDate);

  return {
    firstName: pickFirstName(user),
    age: ageAtDate(profile.date_of_birth, asOfDate),
    sector: SECTOR_LABEL[SectorSchema.parse(profile.sector)] ?? profile.sector,
    tier: TIER_LABEL[TrajectoryTierSchema.parse(profile.trajectory_tier)] ?? profile.trajectory_tier,
    tierDescription:
      TIER_DESCRIPTION[profile.trajectory_tier] ?? "self-selected trajectory",
    currentSalary: profile.current_salary,
    monthlySurplus: Math.round(monthlySurplusPence / 100),
    goals: goalsWithTrajectory,
    scores: {
      spending: scores.spending,
      growth: scores.growth,
      borrowing: scores.borrowing,
    },
    spendingByType: summariseSpendingByType(transactions, asOfDate),
  };
}

function pickFirstName(user: User): string {
  const metadata = user.user_metadata as
    | { full_name?: string; name?: string; first_name?: string }
    | undefined;
  const raw =
    metadata?.first_name ??
    metadata?.full_name?.split(" ")[0] ??
    metadata?.name?.split(" ")[0] ??
    user.email?.split("@")[0];
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "there";
}

function summariseSpendingByType(
  transactions: { amount: number; date: string; category: string }[],
  asOfDate: Date,
): { type: string; amount: number }[] {
  const cutoff = new Date(asOfDate);
  cutoff.setDate(cutoff.getDate() - SPENDING_WINDOW_DAYS);

  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const when = new Date(t.date);
    if (when < cutoff || when > asOfDate) continue;
    if (t.category === "transfer") continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + Math.abs(t.amount));
  }
  return [...totals.entries()]
    .map(([type, pence]) => ({ type, amount: Math.round(pence / 100) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_SPENDING_TYPES);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
