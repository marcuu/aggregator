import { redirect } from "next/navigation";

import { createClient, getRequestUserId } from "@/lib/supabase/server";
import { calculateTrajectoryAge } from "@/lib/trajectory/engine";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { getFinancialState, attributeSavingsToGoals } from "@/lib/finance/state";
import { RevealScreen } from "@/components/onboarding/RevealScreen";
import { UserProfileSchema } from "@/lib/validators/profile";
import { GoalSchema, type GoalType } from "@/lib/validators/goals";

/** Reveal the highest-priority goal: home, then wedding, then the rest. */
const PRIORITY: Record<GoalType, number> = {
  home: 0,
  wedding: 1,
  emergency_fund: 2,
  invest_start: 3,
};

const GOAL_LABEL: Record<GoalType, string> = {
  home: "Your first home",
  wedding: "Your wedding",
  emergency_fund: "Your emergency fund",
  invest_start: "Your first investments",
};

export default async function Reveal() {
  const userId = await getRequestUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const [{ data: profileRow }, { data: goalRows }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (!profileRow || !goalRows || goalRows.length === 0) {
    redirect("/dashboard");
  }

  const profile = UserProfileSchema.parse(profileRow);
  const goals = goalRows.map((g) => GoalSchema.parse(g));
  const primary = [...goals].sort(
    (a, b) => PRIORITY[a.type] - PRIORITY[b.type],
  )[0];

  const [{ data: benchmarkRows }, transactions, financialState] =
    await Promise.all([
      supabase
        .from("salary_benchmarks")
        .select("sector, tier, age, salary_p25, salary_p50, salary_p75")
        .eq("sector", profile.sector)
        .eq("tier", profile.trajectory_tier),
      getTransactionsForUser(userId, supabase),
      getFinancialState(userId, supabase),
    ]);

  // Attribute synced savings across the user's goals and use the primary
  // goal's share — the same derive-on-read path the dashboard uses, so the
  // reveal animation matches what they'll see afterwards.
  const savedByGoal = attributeSavingsToGoals(goals, financialState);
  const savedPence = savedByGoal.get(primary.id) ?? 0;

  // The engine works in pence; goal amounts are stored in whole pounds.
  const goalInPence = {
    ...primary,
    target_amount: primary.target_amount * 100,
    saved_amount: savedPence,
  };

  const trajectory = calculateTrajectoryAge(
    profile,
    goalInPence,
    transactions,
    (benchmarkRows ?? []) as BenchmarkRow[],
    new Date(),
  );

  return (
    <RevealScreen
      trajectoryAge={trajectory.trajectoryAge}
      goalLabel={GOAL_LABEL[primary.type]}
      monthlySurplusPence={trajectory.monthlySurplus}
      savedAmountPence={trajectory.savedAmount}
      cohortPercentile={trajectory.cohortPercentile}
    />
  );
}
