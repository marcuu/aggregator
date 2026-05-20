import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { calculateTrajectoryAge } from "@/lib/trajectory/engine";
import { calculateScores } from "@/lib/trajectory/scores";
import type { BenchmarkRow } from "@/lib/trajectory/benchmarks";
import { getTransactionsForUser } from "@/lib/truelayer/transactions";
import { UserProfileSchema } from "@/lib/validators/profile";
import { GoalSchema, type Goal } from "@/lib/validators/goals";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function toEnginePence(goal: Goal): Goal {
  return {
    ...goal,
    target_amount: goal.target_amount * 100,
    saved_amount: goal.saved_amount * 100,
  };
}

/**
 * Weekly trajectory snapshot (see vercel.json crons). For every onboarded
 * user it records one row per active goal, which powers the home-screen
 * sparklines and the week-on-week score deltas. Writes with the service
 * role; authenticated via the CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const [{ data: profileRows }, { data: benchmarkRows }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("onboarding_complete", true),
    supabase
      .from("salary_benchmarks")
      .select("sector, tier, age, salary_p25, salary_p50, salary_p75"),
  ]);

  const benchmarks = (benchmarkRows ?? []) as BenchmarkRow[];
  let snapshots = 0;

  for (const profileRow of profileRows ?? []) {
    const profile = UserProfileSchema.parse(profileRow);

    const { data: goalRows } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", profile.user_id)
      .eq("is_active", true);

    const transactions = await getTransactionsForUser(
      profile.user_id,
      supabase,
    );

    const { data: accountRows } = await supabase
      .from("ob_accounts")
      .select("current_balance")
      .eq("user_id", profile.user_id);
    const currentBalancePence = (accountRows ?? [])
      .reduce((sum, a) => sum + Math.round((a.current_balance ?? 0) * 100), 0);

    const scores = calculateScores(profile, transactions, null, currentBalancePence);

    for (const goalRow of goalRows ?? []) {
      const goal = GoalSchema.parse(goalRow);
      const trajectory = calculateTrajectoryAge(
        profile,
        toEnginePence(goal),
        transactions,
        benchmarks,
        new Date(),
      );

      const { error } = await supabase.from("trajectory_snapshots").upsert(
        {
          user_id: profile.user_id,
          goal_id: goal.id,
          snapshot_date: snapshotDate,
          trajectory_age: trajectory.trajectoryAge,
          monthly_surplus: trajectory.monthlySurplus,
          saved_amount: trajectory.savedAmount,
          spending_score: scores.spending,
          growth_score: scores.growth,
          borrowing_score: scores.borrowing,
        },
        { onConflict: "goal_id,snapshot_date" },
      );

      if (error) {
        console.error("Snapshot cron: upsert failed:", error);
      } else {
        snapshots += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    profiles: profileRows?.length ?? 0,
    snapshots,
  });
}
